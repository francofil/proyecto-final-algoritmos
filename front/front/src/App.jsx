import { useState } from 'react'
import './App.css'

// Definición de zonas con coordenadas (simula ubicaciones en una ciudad)
const ZONES = {
  'Centro': { x: 0, y: 0, color: '#646cff' },
  'Norte': { x: 0, y: 15, color: '#4CAF50' },
  'Sur': { x: 0, y: -15, color: '#FF9800' },
  'Este': { x: 15, y: 0, color: '#E91E63' },
  'Oeste': { x: -15, y: 0, color: '#9C27B0' }
}

// Tipos de transporte con sus velocidades promedio (km/h)
const TRANSPORT_TYPES = {
  'bicicleta': { speed: 15, label: 'Bicicleta', color: '#4CAF50' },
  'auto': { speed: 40, label: 'Auto', color: '#2196F3' },
  'transporte_publico': { speed: 25, label: 'Transporte Público', color: '#FF9800' }
}

// Calcular tiempo de viaje entre dos zonas según el tipo de transporte (en horas)
function calculateTravelTime(zone1, zone2, transportType) {
  if (zone1 === zone2) return 0
  
  const z1 = ZONES[zone1]
  const z2 = ZONES[zone2]
  const dx = z1.x - z2.x
  const dy = z1.y - z2.y
  const distance = Math.sqrt(dx * dx + dy * dy) // distancia euclidiana en km
  const speed = TRANSPORT_TYPES[transportType].speed
  return distance / speed // tiempo en horas
}

function App() {
  // Estados para las actividades y configuración
  const [activities, setActivities] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [tmax, setTmax] = useState(20)
  const [penalizedTransport, setPenalizedTransport] = useState('bicicleta')
  const [alpha, setAlpha] = useState(0.25)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  // Estados para el formulario de nueva actividad
  const [newActivity, setNewActivity] = useState({
    name: '',
    value: '',
    duration: '',
    open_time: '',
    close_time: '',
    zone: 'Centro'
  })

  // Agregar nueva actividad
  const handleAddActivity = () => {
    if (!newActivity.name || !newActivity.value || !newActivity.duration || 
        !newActivity.open_time || !newActivity.close_time || !newActivity.zone) {
      alert('Por favor completa todos los campos')
      return
    }

    const activity = {
      id: activities.length,
      name: newActivity.name,
      value: parseFloat(newActivity.value),
      duration: parseFloat(newActivity.duration),
      open_time: parseFloat(newActivity.open_time),
      close_time: parseFloat(newActivity.close_time),
      zone: newActivity.zone
    }

    setActivities([...activities, activity])
    setNewActivity({ name: '', value: '', duration: '', open_time: '', close_time: '', zone: 'Centro' })
    setShowModal(false)
  }

  // Eliminar actividad
  const handleDeleteActivity = (id) => {
    setActivities(activities.filter(act => act.id !== id))
  }

  // Cargar actividades de ejemplo del notebook
  const handleLoadExampleActivities = () => {
    const exampleActivities = [
      { id: 0, name: "Desayuno", value: 3, duration: 0.5, open_time: 7.0, close_time: 9.0, zone: "Centro" },
      { id: 1, name: "Gimnasio", value: 8, duration: 1.0, open_time: 7.0, close_time: 11.0, zone: "Norte" },
      { id: 2, name: "Clases", value: 12, duration: 2.0, open_time: 8.0, close_time: 12.0, zone: "Centro" },
      { id: 3, name: "Biblioteca", value: 10, duration: 2.0, open_time: 9.0, close_time: 18.0, zone: "Este" },
      { id: 4, name: "Almuerzo", value: 5, duration: 1.0, open_time: 12.0, close_time: 15.0, zone: "Centro" },
      { id: 5, name: "Trabajo grupal", value: 9, duration: 1.5, open_time: 13.0, close_time: 17.0, zone: "Sur" },
      { id: 6, name: "Supermercado", value: 6, duration: 0.5, open_time: 10.0, close_time: 20.0, zone: "Oeste" },
      { id: 7, name: "Descanso", value: 4, duration: 1.0, open_time: 14.0, close_time: 18.0, zone: "Norte" },
      { id: 8, name: "Cena", value: 6, duration: 1.0, open_time: 19.0, close_time: 22.0, zone: "Centro" },
      { id: 9, name: "Recreación", value: 7, duration: 1.5, open_time: 17.0, close_time: 21.0, zone: "Sur" }
    ]
    setActivities(exampleActivities)
  }

  // Cargar dataset enfocado en sostenibilidad (minimizar auto)
  const handleLoadSustainabilityExample = () => {
    const sustainabilityActivities = [
      { id: 0, name: "Yoga matutino", value: 7, duration: 1.0, open_time: 6.0, close_time: 9.0, zone: "Norte" },
      { id: 1, name: "Reunión virtual", value: 10, duration: 1.5, open_time: 9.0, close_time: 13.0, zone: "Centro" },
      { id: 2, name: "Almuerzo saludable", value: 6, duration: 1.0, open_time: 12.0, close_time: 15.0, zone: "Centro" },
      { id: 3, name: "Taller presencial", value: 15, duration: 2.5, open_time: 14.0, close_time: 18.0, zone: "Oeste" },
      { id: 4, name: "Mercado local", value: 8, duration: 1.0, open_time: 10.0, close_time: 20.0, zone: "Este" },
      { id: 5, name: "Ciclismo recreativo", value: 9, duration: 1.5, open_time: 16.0, close_time: 20.0, zone: "Sur" },
      { id: 6, name: "Cena con amigos", value: 8, duration: 2.0, open_time: 19.0, close_time: 22.0, zone: "Norte" },
      { id: 7, name: "Café networking", value: 11, duration: 1.0, open_time: 10.0, close_time: 17.0, zone: "Este" }
    ]
    setActivities(sustainabilityActivities)
  }

  // Calcular jornada óptima
  const handleCalculate = async () => {
    if (activities.length === 0) {
      alert('Agrega al menos una actividad')
      return
    }

    setLoading(true)
    setResults(null)

    // Generar matrices de tiempos de viaje para cada tipo de transporte
    const n = activities.length
    const travelTimeBicicleta = Array(n).fill(0).map((_, i) => 
      Array(n).fill(0).map((_, j) => {
        if (i === j) return 0
        return calculateTravelTime(activities[i].zone, activities[j].zone, 'bicicleta')
      })
    )
    const travelTimeAuto = Array(n).fill(0).map((_, i) => 
      Array(n).fill(0).map((_, j) => {
        if (i === j) return 0
        return calculateTravelTime(activities[i].zone, activities[j].zone, 'auto')
      })
    )
    const travelTimeTransportePublico = Array(n).fill(0).map((_, i) => 
      Array(n).fill(0).map((_, j) => {
        if (i === j) return 0
        return calculateTravelTime(activities[i].zone, activities[j].zone, 'transporte_publico')
      })
    )
    
    // La matriz general usa el tiempo mínimo entre todos los transportes
    const travelTime = Array(n).fill(0).map((_, i) => 
      Array(n).fill(0).map((_, j) => {
        if (i === j) return 0
        return Math.min(
          travelTimeBicicleta[i][j],
          travelTimeAuto[i][j],
          travelTimeTransportePublico[i][j]
        )
      })
    )

    // Reindexar actividades con IDs consecutivos
    const reindexedActivities = activities.map((act, idx) => ({
      id: idx,
      name: act.name,
      value: act.value,
      duration: act.duration,
      open_time: act.open_time,
      close_time: act.close_time
    }))

    const requestBody = {
      activities: reindexedActivities,
      travel_time: travelTime,
      travel_time_bicicleta: travelTimeBicicleta,
      travel_time_auto: travelTimeAuto,
      travel_time_transporte_publico: travelTimeTransportePublico,
      penalized_transport: penalizedTransport,
      tmax: parseFloat(tmax),
      alpha: parseFloat(alpha)
    }

    try {
      const response = await fetch('http://localhost:8000/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error('Error en la respuesta del servidor')
      }

      const data = await response.json()
      setResults(data)
    } catch (error) {
      console.error('Error:', error)
      alert('Error al calcular la jornada. Asegúrate de que el backend esté corriendo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <h1>📅 ¡Organiza tu Jornada!</h1>
      <p className="subtitle">Optimiza tu día con algoritmo A*</p>

      <div className="controls-section">
        <div className="config-inputs">
          <div className="input-group">
            <label>Horario disponible (horas):</label>
            <input
              type="number"
              value={tmax}
              onChange={(e) => setTmax(e.target.value)}
              min="1"
              max="24"
              step="0.5"
            />
          </div>
          <div className="input-group">
            <label>Transporte a Minimizar:</label>
            <select
              value={penalizedTransport}
              onChange={(e) => setPenalizedTransport(e.target.value)}
              className="transport-select"
            >
              {Object.entries(TRANSPORT_TYPES).map(([key, transport]) => (
                <option key={key} value={key}>
                  {transport.label}
                </option>
              ))}
            </select>
            <small className="input-hint">
              El algoritmo intentará minimizar el uso de este transporte
            </small>
          </div>
          <div className="input-group">
            <label>Minimizar tiempo de viaje (α):</label>
            <input
              type="number"
              value={alpha}
              onChange={(e) => setAlpha(e.target.value)}
              min="0"
              max="2"
              step="0.05"
            />
            <small className="input-hint">Mayor valor = más penalización al transporte</small>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            ➕ Agregar Actividad
          </button>
          <button className="btn-secondary" onClick={handleLoadExampleActivities}>
             Dataset Notebook
          </button>
          <button className="btn-secondary" onClick={handleLoadSustainabilityExample}>
             Dataset 2
          </button>
        </div>
      </div>

      {/* Lista de actividades */}
      <div className="activities-section">
        <h2>Actividades ({activities.length})</h2>
        {activities.length === 0 ? (
          <p className="empty-message">No hay actividades. ¡Agrega la primera!</p>
        ) : (
          <div className="activities-list">
            {activities.map((act) => (
              <div key={act.id} className="activity-card">
                <div className="activity-info">
                  <div className="activity-header">
                    <h3>{act.name}</h3>
                    <span 
                      className="zone-badge" 
                      style={{ backgroundColor: ZONES[act.zone].color }}
                    >
                      {act.zone}
                    </span>
                  </div>
                  <div className="activity-details">
                    <span> Valor: {act.value}</span>
                    <span>⏱️ Duración: {act.duration}h</span>
                    <span>🕐 Horario: {act.open_time}:00 - {act.close_time}:00</span>
                  </div>
                </div>
                <button 
                  className="btn-delete" 
                  onClick={() => handleDeleteActivity(act.id)}
                >
                  X                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Botón calcular */}
      {activities.length > 0 && (
        <button 
          className="btn-calculate" 
          onClick={handleCalculate}
          disabled={loading}
        >
          {loading ? '⏳ Calculando...' : ' Calcular Jornada Óptima'}
        </button>
      )}

      {/* Resultados */}
      {results && (
        <div className="results-section">
          <h2>📊 Resultado de tu Jornada</h2>
          <div className="transport-info">
            <span style={{ color: TRANSPORT_TYPES[penalizedTransport].color, fontWeight: 'bold' }}>
              Minimizando: {TRANSPORT_TYPES[penalizedTransport].label}
            </span>
          </div>
          <div className="results-summary">
            <div className="summary-item">
              <span className="label">Valor Total:</span>
              <span className="value">{results.total_value}</span>
            </div>
            <div className="summary-item">
              <span className="label">Tiempo Total de Transporte:</span>
              <span className="value">{results.total_travel_cost}h</span>
            </div>
            <div className="summary-item">
              <span className="label">Tiempo en {TRANSPORT_TYPES[penalizedTransport].label}:</span>
              <span className="value" style={{ color: TRANSPORT_TYPES[penalizedTransport].color }}>
                {results.penalized_travel_cost}h
              </span>
            </div>
            <div className="summary-item">
              <span className="label">Tiempo Final:</span>
              <span className="value">{results.final_time}h</span>
            </div>
            <div className="summary-item highlight">
              <span className="label">Objetivo:</span>
              <span className="value">{results.objective}</span>
            </div>
          </div>

          <h3>📋 Actividades en Orden Cronológico:</h3>
          <div className="route-list">
            {results.route.map((act, index) => (
              <div key={index} className="route-item">
                <div className="route-number">{index + 1}</div>
                <div className="route-info">
                  <h4>{act.name}</h4>
                  <p>Valor: {act.value} | Duración: {act.duration}h</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal para agregar actividad */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>➕ Nueva Actividad</h2>
            <div className="form-group">
              <label>Nombre:</label>
              <input
                type="text"
                placeholder="Ej: Gimnasio"
                value={newActivity.name}
                onChange={(e) => setNewActivity({...newActivity, name: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Valor/Utilidad:</label>
              <input
                type="number"
                placeholder="1-10"
                value={newActivity.value}
                onChange={(e) => setNewActivity({...newActivity, value: e.target.value})}
                min="0"
                step="0.5"
              />
            </div>
            <div className="form-group">
              <label>Duración (horas):</label>
              <input
                type="number"
                placeholder="1.5"
                value={newActivity.duration}
                onChange={(e) => setNewActivity({...newActivity, duration: e.target.value})}
                min="0.5"
                step="0.5"
              />
            </div>
            <div className="form-group">
              <label>Zona/Ubicación:</label>
              <select
                value={newActivity.zone}
                onChange={(e) => setNewActivity({...newActivity, zone: e.target.value})}
                className="zone-select"
              >
                {Object.keys(ZONES).map(zone => (
                  <option key={zone} value={zone}>
                     {zone}
                  </option>
                ))}
              </select>
              <small className="input-hint">
                Las zonas determinan el tiempo de viaje entre actividades
              </small>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Hora inicio:</label>
                <input
                  type="number"
                  placeholder="8"
                  value={newActivity.open_time}
                  onChange={(e) => setNewActivity({...newActivity, open_time: e.target.value})}
                  min="0"
                  max="24"
                  step="0.5"
                />
              </div>
              <div className="form-group">
                <label>Hora límite:</label>
                <input
                  type="number"
                  placeholder="18"
                  value={newActivity.close_time}
                  onChange={(e) => setNewActivity({...newActivity, close_time: e.target.value})}
                  min="0"
                  max="24"
                  step="0.5"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleAddActivity}>
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
