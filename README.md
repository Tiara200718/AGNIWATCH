
# 🌍 AGNIWATCH — Global Wildfire Intelligence System

**An Interactive 3D Earth Dashboard for Satellite-Based Wildfire Hotspot Monitoring**

AGNIWATCH is a global wildfire hotspot monitoring and visualization platform that uses NASA FIRMS satellite observations to help users explore fire activity across different regions of the world.

By combining satellite data, interactive 3D Earth visualization, and analytical dashboards, AGNIWATCH makes wildfire-related information easier to explore and understand.

## 🚀 Key Features

- 🌎 **Interactive 3D Earth:** Explore the globe with an interactive Three.js visualization.
- 🔥 **Global Hotspot Monitoring:** Visualize satellite-detected thermal anomalies geographically.
- 🛰️ **NASA FIRMS Integration:** Retrieve satellite observations from MODIS and VIIRS sources.
- 📊 **Fire Analytics:** Explore hotspot statistics and fire-related data through charts.
- 📍 **Hotspot Inspection:** Examine individual detections and their geographic coordinates.
- 🎛️ **Interactive Dashboard:** Explore data using available filters and dashboard controls.

## 📸 Project Screenshots

### Main Dashboard

<img width="1914" height="982" alt="image" src="https://github.com/user-attachments/assets/caa2ae26-af66-4d4d-90c8-badde81bd39d" />

### Interactive 3D Earth

<img width="1118" height="753" alt="image" src="https://github.com/user-attachments/assets/739a8b44-c4a5-47b2-b094-060430f58ea5" />

### Fire Analytics

<img width="738" height="700" alt="nasa" src="https://github.com/user-attachments/assets/3634d02b-f24e-4be2-b3af-34a18f7c83aa" />

## 🌐 Live Application

🚀 **Explore AGNIWATCH:**  
https://agniwatch-1.onrender.com

🔗 **Backend API:**  
https://agniwatch.onrender.com

💻 **GitHub Repository:**  
https://github.com/Tiara200718/AGNIWATCH
## 🛠️ Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Dashboard structure |
| CSS3 | Interface design |
| JavaScript | Frontend functionality |
| Three.js | 3D Earth visualization |
| Chart.js | Data visualization |
| Python | Backend development |
| Flask | REST API |
| NASA FIRMS | Satellite hotspot observations |

## 🛰️ Data Source

**NASA Fire Information for Resource Management System (FIRMS)**

AGNIWATCH uses NASA FIRMS observations from:

- MODIS
- VIIRS Suomi-NPP
- VIIRS NOAA-20
- VIIRS NOAA-21

Data represents satellite-detected thermal anomalies and should not be interpreted as confirmed fire boundaries or emergency alerts. Near-real-time data availability and reporting delays may vary.

Source: https://firms.modaps.eosdis.nasa.gov/

## ⚙️ Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/Tiara200718/AGNIWATCH.git
cd AGNIWATCH
```

### 2. Install Python dependencies

```bash
pip install flask flask-cors requests python-dotenv
```

### 3. Configure your NASA FIRMS API key

Create a `.env` file in the project root:

```env
NASA_FIRMS_MAP_KEY=your_api_key
```

Get your key from NASA FIRMS.

### 4. Start the backend

```bash
python backend/app.py
```

Backend API:

```text
http://127.0.0.1:5000
```

### 5. Launch the frontend

Open `index.html` using VS Code Live Server.

## 🔮 Project Vision

AGNIWATCH aims to make satellite-based wildfire observations more accessible through interactive visualization and data exploration.

The platform demonstrates how geospatial technologies, satellite observations, and modern web development can work together to support environmental awareness.

## 🏆 Challenge

Developed as a project for the **NASA Space Apps Challenge 2026**.

## 👩‍💻 Developed By

**Team: दृष्टि (Nayantara)**

**Project: AGNIWATCH**

🌍 Exploring Earth. Understanding Fire. Supporting Awareness.

---

*Disclaimer: AGNIWATCH is an informational visualization project. It is not an official NASA product and does not replace emergency response systems.*
