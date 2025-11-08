# Proyecto final - Algoritmos Avanzados de Búsqueda y Optimización

Este proyecto corresponde a la materia **Algoritmos Avanzados de Búsqueda y Optimización** (Universidad Católica del Uruguay).  
Desarrollado por **Franco Filardi** y **Joaquín Repetto**.

---

## 🧩 Descripción del problema

El problema consiste en **planificar la jornada diaria de un estudiante universitario**, considerando:

- Un conjunto de **actividades posibles** (clases, gimnasio, biblioteca, comedor, etc.).
- Cada actividad tiene:
  - Un **valor o utilidad**.
  - Una **duración**.
  - Una **ventana de tiempo** en la que puede realizarse.
- Existen **tiempos de traslado** entre actividades.
- El estudiante dispone de un **tiempo total diario limitado (Tmax)**.

El objetivo es **maximizar la utilidad total del día**, eligiendo qué actividades realizar y en qué orden, sin exceder las restricciones de tiempo ni las ventanas horarias.  
Además, se incorpora un **factor de penalización α** para minimizar el tiempo total en transporte.

---

## ⚙️ Modelado formal

- **Conjunto de actividades:**  
  \( V = \{1, 2, \dots, n\} \)

- **Parámetros:**
  - \( v_i \): utilidad de la actividad *i*  
  - \( t_i \): duración  
  - \( d_{ij} \): tiempo de viaje entre actividades *i* y *j*  
  - \( [open_i, close_i] \): ventana de tiempo de *i*  
  - \( T_{max} \): tiempo total disponible

- **Variables de decisión:**
  - \( y_i = 1 \) si la actividad *i* es realizada.  
  - \( x_{ij} = 1 \) si el estudiante se traslada directamente de *i* a *j*.

- **Función objetivo:**
  \[
  \max \sum_i v_i y_i - \alpha \sum_{i,j} d_{ij} x_{ij}
  \]

- **Restricciones principales:**
  1. Cada actividad tiene una llegada y salida únicas.  
  2. El tiempo total no excede \( T_{max} \).  
  3. Se respetan las ventanas de tiempo:  
     \( open_i \leq start_i \leq close_i \).  
  4. No se pueden realizar actividades que se solapen temporalmente.  
  5. Se eliminan subrutas no válidas.

---

## 🧠 Algoritmos implementados

### 🔹 A* (A-star) adaptado a maximización
Heurística de búsqueda informada que encuentra soluciones de alta calidad de forma eficiente.  
La función de evaluación se redefine como:
\[
f(n) = - (v_{acumulado} - \alpha \cdot transporte) + h(n)
\]
donde \( h(n) \) es una cota inferior (admisible).

### 🔹 Branch & Bound
Método exacto de búsqueda en profundidad con poda:
- Calcula una **cota superior optimista** sobre el valor restante posible.
- Poda ramas que no pueden superar la mejor solución actual.
- Devuelve la **solución óptima**, aunque con mayor costo computacional.

---

## 🏗️ Estructura del repositorio

│
├── proyecto_final_algoritmos.ipynb # Notebook principal con las implementaciones
├── Proyecto Final - Algoritmos Avanzados de Búsqueda y Optimización.pdf # Informe de la primera entrega
├── README.md # Este archivo
