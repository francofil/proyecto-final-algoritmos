from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass, field
import heapq

"""
Lo mismo que en el jupyter, pero adaptado a FastAPI para servir como backend, solo se hace llamada a un endpoint.
"""
app = FastAPI()

# Configurar CORS para permitir peticiones desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# MODELOS DE DATOS
# ============================================

@dataclass(frozen=True)
class Activity:
    """
    Representa una actividad individual con sus características.
    - id: identificador único
    - name: nombre de la actividad
    - value: utilidad/valor de realizar esta actividad
    - duration: tiempo que toma completarla (en horas)
    - open_time: hora más temprana en que puede comenzar
    - close_time: hora límite en que debe comenzar
    """
    id: int
    name: str
    value: float
    duration: float
    open_time: float
    close_time: float


@dataclass
class Instance:
    """
    Representa la instancia completa del problema con todas las actividades
    y restricciones del día.
    """
    activities: List[Activity]
    travel_time: List[List[float]]  # Matriz de tiempos de viaje entre actividades (general)
    travel_time_bicicleta: Optional[List[List[float]]] = None
    travel_time_auto: Optional[List[List[float]]] = None
    travel_time_transporte_publico: Optional[List[List[float]]] = None
    penalized_transport: Optional[str] = None  # Tipo de transporte a penalizar
    Tmax: float = 0.0  # Tiempo máximo disponible en el día
    alpha: float = 0.0  # Penalización por tiempo de viaje
    start_id: Optional[int] = None  # Actividad inicial (opcional)

    def __post_init__(self):
        """Inicializa el mapeo de IDs a índices para acceso rápido."""
        n = len(self.activities)
        assert len(self.travel_time) == n and all(len(row) == n for row in self.travel_time)
        self.id_to_idx = {a.id: i for i, a in enumerate(self.activities)}

    def idx(self, act_id: int) -> int:
        """Obtiene el índice de una actividad dado su ID."""
        return self.id_to_idx[act_id]

    def d(self, from_id: int, to_id: int) -> float:
        """Obtiene el tiempo de viaje entre dos actividades (usa el mínimo entre todos los transportes)."""
        return self.travel_time[self.idx(from_id)][self.idx(to_id)]
    
    def d_penalized(self, from_id: int, to_id: int) -> float:
        """
        Retorna el tiempo de viaje usando el transporte penalizado.
        Esto se suma al objetivo con factor alpha.
        """
        idx_from = self.idx(from_id)
        idx_to = self.idx(to_id)
        
        # Retornar el tiempo del transporte penalizado
        if self.penalized_transport == 'bicicleta' and self.travel_time_bicicleta:
            return self.travel_time_bicicleta[idx_from][idx_to]
        elif self.penalized_transport == 'auto' and self.travel_time_auto:
            return self.travel_time_auto[idx_from][idx_to]
        elif self.penalized_transport == 'transporte_publico' and self.travel_time_transporte_publico:
            return self.travel_time_transporte_publico[idx_from][idx_to]
        
        return 0.0
    
    def get_transport_options(self, from_id: int, to_id: int) -> List[Tuple[str, float, float]]:
        """
        Retorna lista de opciones de transporte: (nombre, tiempo_real, tiempo_penalizado).
        Permite al algoritmo elegir entre diferentes transportes.
        """
        idx_from = self.idx(from_id)
        idx_to = self.idx(to_id)
        
        options = []
        
        if self.travel_time_bicicleta:
            tiempo = self.travel_time_bicicleta[idx_from][idx_to]
            penalizado = tiempo if self.penalized_transport == 'bicicleta' else 0.0
            options.append(('bicicleta', tiempo, penalizado))
        
        if self.travel_time_auto:
            tiempo = self.travel_time_auto[idx_from][idx_to]
            penalizado = tiempo if self.penalized_transport == 'auto' else 0.0
            options.append(('auto', tiempo, penalizado))
        
        if self.travel_time_transporte_publico:
            tiempo = self.travel_time_transporte_publico[idx_from][idx_to]
            penalizado = tiempo if self.penalized_transport == 'transporte_publico' else 0.0
            options.append(('transporte_publico', tiempo, penalizado))
        
        return options

    def activity_by_id(self, act_id: int) -> Activity:
        """Obtiene una actividad dado su ID."""
        return self.activities[self.idx(act_id)]


@dataclass(order=True)
class State:
    """
    Representa un estado en la búsqueda A*.
    Incluye la ruta actual, tiempo transcurrido, valor acumulado, etc.
    """
    priority: float  # Prioridad en la cola (para el heap)
    current_id: int = field(compare=False)  # Actividad actual
    time: float = field(compare=False)  # Tiempo transcurrido
    collected_value: float = field(compare=False)  # Valor acumulado
    travel_cost: float = field(compare=False)  # Costo de transporte acumulado (general)
    visited: frozenset = field(compare=False)  # Conjunto de actividades visitadas
    route: Tuple[int, ...] = field(compare=False)  # Ruta de IDs de actividades
    penalized_travel_cost: float = field(compare=False, default=0.0)  # Costo del transporte penalizado

    def total_objective(self, alpha: float) -> float:
        """Calcula el objetivo total: valor - penalización por transporte penalizado."""
        return self.collected_value - alpha * self.penalized_travel_cost


# ============================================
# FUNCIONES AUXILIARES
# ============================================

def feasible_transition(inst: Instance, from_id: int, to_id: int, current_time: float) -> Optional[Tuple[float, float]]:
    """
    Verifica si es factible realizar una transición de una actividad a otra.
    Retorna (tiempo_inicio, tiempo_fin) si es factible, None si no lo es.
    """
    act_j = inst.activity_by_id(to_id)
    travel = inst.d(from_id, to_id)
    arrive = current_time + travel
    start = max(arrive, act_j.open_time)
    
    # Verificar que no llegamos tarde
    if start > act_j.close_time:
        return None
    
    finish = start + act_j.duration
    
    # Verificar que no excedemos el tiempo máximo del día
    if finish > inst.Tmax:
        return None
    
    return (start, finish)


def heuristic(inst: Instance, state: State) -> float:
    """
    Función heurística para A*.
    Estima el valor adicional que podríamos obtener con el tiempo restante,
    usando una relajación donde tomamos actividades en orden de eficiencia
    (valor/duración) sin considerar ventanas de tiempo ni viajes.
    """
    remaining_time = inst.Tmax - state.time
    if remaining_time <= 0:
        return 0.0

    # Actividades aún no visitadas
    unvisited = [a for a in inst.activities if a.id not in state.visited]
    if not unvisited:
        return 0.0

    # Ordenar por eficiencia (valor por unidad de tiempo)
    unvisited.sort(key=lambda a: a.value / max(a.duration, 1e-9), reverse=True)

    possible_value = 0.0
    time_used = 0.0

    # Tomar actividades greedily hasta llenar el tiempo
    for activity in unvisited:
        if time_used + activity.duration <= remaining_time:
            possible_value += activity.value
            time_used += activity.duration
        else:
            # Tomar fracción de la última actividad
            time_left = remaining_time - time_used
            if time_left > 0:
                fraction = time_left / activity.duration
                possible_value += activity.value * fraction
            break

    # Retornar negativo porque queremos maximizar
    return -possible_value


def _astar_from(inst: Instance, start_state: State) -> State:
    """
    Ejecuta A* desde un estado inicial dado.
    Retorna el mejor estado encontrado.
    """
    open_heap: List[State] = []
    heapq.heappush(open_heap, start_state)
    best: State = start_state
    seen: Dict[Tuple[int, frozenset], float] = {}

    while open_heap:
        s = heapq.heappop(open_heap)
        
        # Actualizar mejor solución encontrada
        if s.total_objective(inst.alpha) > best.total_objective(inst.alpha):
            best = s
        
        # Explorar transiciones a actividades no visitadas
        for a in inst.activities:
            if a.id in s.visited:
                continue
            
            # Obtener opciones de transporte
            if s.current_id == a.id:
                # Misma actividad, sin viaje
                transport_options = [('ninguno', 0.0, 0.0)]
            else:
                transport_options = inst.get_transport_options(s.current_id, a.id)
            
            # Probar cada opción de transporte
            for transport_name, travel_time, penalized_time in transport_options:
                # Verificar factibilidad con este transporte
                arrive = s.time + travel_time
                start_time = max(arrive, a.open_time)
                
                if start_time > a.close_time:
                    continue
                
                finish_time = start_time + a.duration
                
                if finish_time > inst.Tmax:
                    continue
                
                # Crear nuevo estado
                ns = State(
                    priority=0.0,
                    current_id=a.id,
                    time=finish_time,
                    collected_value=s.collected_value + a.value,
                    travel_cost=s.travel_cost + travel_time,
                    penalized_travel_cost=s.penalized_travel_cost + penalized_time,
                    visited=s.visited | {a.id},
                    route=s.route + (a.id,)
                )
                
                # Evitar reexplorar estados dominados
                key = (ns.current_id, ns.visited)
                val = ns.total_objective(inst.alpha)
                if key in seen and seen[key] >= val:
                    continue
                seen[key] = val
                
                # Calcular prioridad con heurística
                estimated_total = val + heuristic(inst, ns)
                ns.priority = -estimated_total
                heapq.heappush(open_heap, ns)
    
    return best


def astar_maximize(inst: Instance) -> State:
    """
    Algoritmo A* para maximizar el valor de actividades realizadas.
    Prueba comenzar desde cada actividad factible y retorna la mejor solución.
    """
    if inst.start_id is None:
        best_state: Optional[State] = None
        
        # Probar comenzar desde cada actividad
        for a in inst.activities:
            ok = feasible_transition(inst, a.id, a.id, 0.0)
            if ok is None:
                continue
            
            start, finish = ok
            s = State(
                priority=0.0,
                current_id=a.id,
                time=finish,
                collected_value=a.value,
                travel_cost=0.0,
                penalized_travel_cost=0.0,
                visited=frozenset({a.id}),
                route=(a.id,)
            )
            estimated_total = s.total_objective(inst.alpha) + heuristic(inst, s)
            s.priority = -estimated_total
            
            cand = _astar_from(inst, s)
            
            if (best_state is None) or (cand.total_objective(inst.alpha) > best_state.total_objective(inst.alpha)):
                best_state = cand
        
        if best_state is None:
            return State(
                priority=0.0,
                current_id=-1,
                time=0.0,
                collected_value=0.0,
                travel_cost=0.0,
                penalized_travel_cost=0.0,
                visited=frozenset(),
                route=()
            )
        return best_state
    else:
        # Comenzar desde actividad específica
        initial = State(
            priority=0.0,
            current_id=inst.start_id,
            time=0.0,
            collected_value=0.0,
            travel_cost=0.0,
            penalized_travel_cost=0.0,
            visited=frozenset(),
            route=()
        )
        estimated_total = initial.total_objective(inst.alpha) + heuristic(inst, initial)
        initial.priority = -estimated_total
        return _astar_from(inst, initial)


# ============================================
# MODELOS PYDANTIC PARA LA API
# ============================================

class ActivityInput(BaseModel):
    """Modelo para recibir actividades desde el frontend."""
    id: int
    name: str
    value: float
    duration: float
    open_time: float
    close_time: float


class PlannerRequest(BaseModel):
    """Modelo para la petición completa al endpoint."""
    activities: List[ActivityInput]
    travel_time: List[List[float]]
    travel_time_bicicleta: Optional[List[List[float]]] = None
    travel_time_auto: Optional[List[List[float]]] = None
    travel_time_transporte_publico: Optional[List[List[float]]] = None
    penalized_transport: Optional[str] = None  # 'bicicleta', 'auto', 'transporte_publico'
    tmax: float
    alpha: float = 0.25


class ActivityOutput(BaseModel):
    """Modelo para devolver información de una actividad en la solución."""
    id: int
    name: str
    value: float
    duration: float
    open_time: float
    close_time: float


class PlannerResponse(BaseModel):
    """Modelo para la respuesta del endpoint."""
    route: List[ActivityOutput]
    total_value: float
    total_travel_cost: float
    penalized_travel_cost: float
    final_time: float
    objective: float


# ============================================
# ENDPOINTS
# ============================================

@app.get("/")
def root():
    """Endpoint de verificación básica."""
    return {"message": "API del Planificador de Actividades funcionando!"}


@app.post("/optimize", response_model=PlannerResponse)
def optimize_schedule(request: PlannerRequest):
    """
    Endpoint principal que recibe las actividades y parámetros del día,
    ejecuta el algoritmo A* y retorna la ruta óptima de actividades.
    
    Parámetros:
    - activities: lista de actividades con sus características
    - travel_time: matriz de tiempos de viaje entre actividades
    - tmax: tiempo máximo disponible en el día
    - alpha: factor de penalización por tiempo de viaje
    
    Retorna:
    - route: lista de actividades en el orden óptimo
    - total_value: suma de valores de las actividades realizadas
    - total_travel_cost: tiempo total gastado en transportes
    - final_time: tiempo final del día
    - objective: valor objetivo (value - alpha * travel_cost)
    """
    # Convertir las actividades de Pydantic a dataclass
    activities = [
        Activity(
            id=act.id,
            name=act.name,
            value=act.value,
            duration=act.duration,
            open_time=act.open_time,
            close_time=act.close_time
        )
        for act in request.activities
    ]
    
    # Crear la instancia del problema
    instance = Instance(
        activities=activities,
        travel_time=request.travel_time,
        travel_time_bicicleta=request.travel_time_bicicleta,
        travel_time_auto=request.travel_time_auto,
        travel_time_transporte_publico=request.travel_time_transporte_publico,
        penalized_transport=request.penalized_transport,
        Tmax=request.tmax,
        alpha=request.alpha
    )
    
    # Ejecutar el algoritmo A*
    solution = astar_maximize(instance)
    
    # Construir la respuesta con las actividades en orden
    route_activities = [
        ActivityOutput(
            id=instance.activity_by_id(act_id).id,
            name=instance.activity_by_id(act_id).name,
            value=instance.activity_by_id(act_id).value,
            duration=instance.activity_by_id(act_id).duration,
            open_time=instance.activity_by_id(act_id).open_time,
            close_time=instance.activity_by_id(act_id).close_time
        )
        for act_id in solution.route
    ]
    
    return PlannerResponse(
        route=route_activities,
        total_value=solution.collected_value,
        total_travel_cost=round(solution.travel_cost, 2),
        penalized_travel_cost=round(solution.penalized_travel_cost, 2),
        final_time=round(solution.time, 2),
        objective=round(solution.total_objective(instance.alpha), 2)
    )

