<!-- Made for Environmental Hacks by Neil Emmanuel Mathias and Ancilla Teresa D'Souza -->
# Ecolens — See the Air You Breathe

Ecolens is a precision environmental stewardship and navigation platform designed to paint the air quality, heat, and carbon reality of every street around you in real time. It bridges satellite atmospheric physics, hyperlocal air sensor networks, and human mobility, empowering commuters, sensitive individuals, and students to navigate cities while minimizing toxic pollutant inhalation and carbon footprint.

---

## 🌟 Comprehensive Feature Tour

Ecolens integrates full-stack capabilities spanning precision navigation, satellite physics, multi-agent AI, and pediatric safety policies across both our **React/MapLibre Frontend** and **FastAPI/AWS Backend**.

---

### 1. 🚶 Precision Clean Routing & Inhalation Dose Engine
Standard GPS navigation optimizes purely for travel speed, funneling pedestrians, cyclists, and commuters straight through congested diesel exhaust corridors and construction dust. Ecolens models pollution down to individual street segments:
* **Fastest vs. Eco-Clean Route Comparison**: Side-by-side route generation comparing distance, travel time, and total respiratory pollutant intake.
* **Gaussian Process Regression (GPR) Spatial Interpolation**: Runs an asynchronous spatial machine learning pipeline (`app/ml/gpr_interpolation.py`) every 30 minutes, interpolating sparse ground-sensor data across road segment centroids using an RBF + White noise kernel.
* **Segment-Level EcoScore (0–100)**: Evaluates road segments dynamically based on real-time $PM_{2.5}$, $NO_2$, estimated vehicle $CO_2$ emissions, ambient noise levels (dB), and urban green canopy density (NDVI).
* **Physiological Inhalation Dose Modeling**: Calculates cumulative microgram intake ($Dose = \int C(x,t) \cdot V_E \cdot dt$) tailored to transportation mode (Walking, Cycling, Driving) and user minute ventilation volume.
* **Dynamic Active Rerouting**: Evaluates changing conditions during active transit; triggers automated rerouting recommendations if downwind smoke or traffic smog spikes along the route.

---

### 2. 🗺️ Interactive Live Map & Geospatial Overlays
Powered by MapLibre GL for 60fps vector map rendering with real-time toggleable data layers:
* **Hyperlocal AQI Station Network**: Live ground sensors aggregated from OpenAQ and WAQI with instant popup diagnostics.
* **NASA EONET Satellite Fire Hotspots**: Near real-time thermal anomaly coordinates from NASA MODIS and VIIRS satellites pinpointing agricultural stubble burning and wildfires.
* **Wind Vector & Dispersion Trajectory**: Real-time atmospheric wind directions and velocities from Open-Meteo, rendering active smoke plume dispersion cones.
* **Dynamic Segment Heat Overlays**: Street-level colored segments representing local exposure risks.
* **Point-to-Point Waypoint Geocoding**: Interactive address search, landmark geocoding, and one-click map coordinate selection.

---

### 3. 🌾 Stubble Burning & Wildfire Plume Radar
Specifically engineered for **Track 01: Air**:
* **High-Throughput Spatial Hotspot Querying**: Scans a 600 km radius around the user to detect active agricultural burning and forest fires.
* **Downwind Arrival Countdown**: Combines fire coordinates with live wind vectors to calculate estimated plume arrival hours before ground smog settles.
* **Serverless Plume Dispersion Microservice**: Built on AWS SAM CLI (`PlumeDispersionFunction`) to calculate Gaussian plume diffusion models off the main API thread.

---

### 4. 🏠 Indoor Air Quality & Smart Ventilation Advisory
Addresses the indoor environmental health of homes, dorms, and classrooms:
* **EPA / ASHRAE Multi-Scenario Infiltration Model**: Predicts indoor particle concentrations across four distinct structural states: *Windows Open*, *Windows Closed*, *Standard AC Filter*, and *True HEPA Purifier*.
* **24-Hour Diurnal Forecast Window**: Evaluates diurnal atmospheric temperature inversions to compute the cleanest 2-hour window of the day to safely air out indoor living spaces.

---

### 5. 🎒 School Safety & Pediatric Commute Matrix
Protects vulnerable children and sensitive groups who breathe at $1.52\times$ adult minute ventilation rates:
* **EPA Flag Program Matrix**: Prescriptive, color-coded action rules for morning drop-off, recess, afternoon pick-up bell windows, and competitive athletics.
* **Verifiable AWS Cedar Policies**: Evaluates formal Cedar policy files (`app/policies/pediatric_safety.cedar`) to mathematically authorize or forbid outdoor exertion without relying on ungrounded LLM guesses.

---

### 6. 🧭 Explore Hub: AI Eco-Travel Planner (Multi-Agent Team)
Empowers sustainable weekend getaways and road trips:
* **Collaborative 2-Agent Architecture**: Powered by the **Agno** framework:
  * **Researcher Agent**: Searches live destinations, public transit links, and low-carbon accommodations via SerpAPI.
  * **Planner Agent**: Synthesizes findings into a day-by-day eco-conscious travel itinerary.
* **Calendar Export (`.ics`)**: Generates and downloads standard iCalendar schedules with scheduled activities and transit times.
* **Bedrock & Groq LLM Support**: Seamlessly swappable between Amazon Bedrock (Claude 3.5 Sonnet / Amazon Nova) and Groq.

---

### 7. 🎧 Explore Hub: AI Audio Tour Guide (5-Agent Specialized Team)
Transforms any walking or cycling trip into an educational, localized tour:
* **5-Specialized-Agent Brain**: Orchestrates collaborative narration from:
  1. *Environmental Agent* (micro-climates, biodiversity, air quality history)
  2. *Historical Agent* (heritage and historical events)
  3. *Cultural Agent* (traditions and community life)
  4. *Culinary Agent* (local sustainable food and regional delicacies)
  5. *Architectural Agent* (urban design and landmark structures)
* **Local Speech Synthesis**: Converts synthesized narration into `.mp3` audio using Google Text-to-Speech (gTTS).
* **Cloud Storage Streaming**: Automatically uploaded to and streamed from AWS S3 or LocalStack (`ecolens-audio-tours` bucket).
* **Interactive Player UI**: Audio controls with time-stamped script preview and instant playback.

---

### 8. 💬 AI Environmental Assistant
* **Context-Aware Conversational Agent**: Interactive assistant (`/assistant`) trained on environmental guidelines, offering advice on asthma precautions, mask types (N95 vs surgical), optimal exercise hours, and route choices.

---

### 9. 📊 Personal Exposure Dashboard & Trip Analytics
* **Lifetime Exposure Metrics**: Visualizes lifetime $PM_{2.5}$ mass avoided, clean kilometers traveled, and carbon footprint reduction.
* **Daily & Weekly Inhalation Charts**: Cumulative pollutant exposure tracking against WHO and EPA guidelines (`/dashboard/exposure`).
* **Trip History & Retrospective Analytics**: Full audit trail of past trips (`/dashboard/history` and `/dashboard/history/:tripId`) with interactive maps and segment-by-segment exposure breakdown.
* **Post-Trip Summary Card**: Immediate post-commute scorecard displaying clean air savings (`/summary`).

---

### 10. 👤 Profile & Respiratory Vulnerability Settings
* **Custom Health Profiles**: Users can declare conditions such as Asthma, COPD, Pediatric/Child, or Senior status.
* **Dynamic Sensitivity Scaling**: Automatically recalibrates breathing minute volumes, Cedar policy evaluations, and map alert thresholds.

---

### 11. 🚨 Air Quality Push Alerts & Notification Center
* **Proactive Exposure Alerts**: Automated push warnings (`/alert/:id`, `/api/alerts`) when nearby AQI crosses hazardous thresholds or satellite fire plumes shift into user paths.
* **Customizable Preferences**: Granular notification toggles for morning commute summaries, indoor ventilation reminders, and extreme hazard spikes.

---

### 12. 🔐 Full Authentication & Security
* **JWT-Based Authentication**: Secure registration, login, token refresh, and logout (`/auth/signin`, `/auth/signup`).
* **Self-Service Account Recovery**: OTP-based password reset workflow (`/auth/forgot-password`).

---

## ☁️ How AWS Was Used (Judging Criteria 02)

To achieve enterprise reliability, high-throughput spatial indexing, and strict pediatric health safety while maintaining **100% open-source local execution (zero AWS account, zero credit card, zero bill)**, Ecolens integrates a dual-mode AWS architecture:

```
                                  ┌── True  ──> AWS S3 / LocalStack (boto3) [Port: 4566]
USE_LOCALSTACK / USE_AWS_S3       │
(Default Fallback: false)         └── False ──> Local Storage (Backend/generated_audio/) [Active]

                                  ┌── True  ──> AWS OpenSearch (geo_point queries) [Port: 9200]
USE_OPENSEARCH                    │
(Default Fallback: false)         └── False ──> Pure Python In-Memory Haversine Math [Active]

                                  ┌── True  ──> AWS Cedar Policy Engine (.cedar AST)
USE_CEDAR_POLICIES                │
(Default Fallback: false)         └── False ──> Declarative EPA Matrix Fallback [Active]

                                  ┌── True  ──> Amazon Bedrock (Claude 3.5 Sonnet / Nova)
USE_AWS_BEDROCK                   │
(Default Fallback: false)         └── False ──> Groq (Llama/Qwen) & Google Gemini [Active]
```

### 1. AWS Open-Source & Cloud Services Integrated

| Service / Tool | Implementation File | Role in Ecolens |
| :--- | :--- | :--- |
| **AWS Cedar Policy Language** | [`app/policies/pediatric_safety.cedar`](file:///d:/ECOLANE/Backend/app/policies/pediatric_safety.cedar)<br>[`app/aws/cedar_policy.py`](file:///d:/ECOLANE/Backend/app/aws/cedar_policy.py) | Declarative, verifiable policy engine authorizing school outdoor play, athletic cancellation, and sensitive student commute safety based on real-time AQI. |
| **AWS OpenSearch** | [`app/aws/opensearch_service.py`](file:///d:/ECOLANE/Backend/app/aws/opensearch_service.py) | Dynamic `geo_point` spatial indexing scanning hundreds of NASA EONET satellite wildfire hotspots across a 600 km radius with sub-millisecond query latency. |
| **Amazon Bedrock & Agno** | [`app/agents/bedrock_provider.py`](file:///d:/ECOLANE/Backend/app/agents/bedrock_provider.py)<br>[`app/agents/travel_planner.py`](file:///d:/ECOLANE/Backend/app/agents/travel_planner.py)<br>[`app/agents/audio_tour.py`](file:///d:/ECOLANE/Backend/app/agents/audio_tour.py) | Multi-agent travel planning and 5-agent audio tour guide generation using Anthropic Claude 3.5 Sonnet and Amazon Nova. |
| **LocalStack & AWS S3** | [`app/aws/aws_storage.py`](file:///d:/ECOLANE/Backend/app/aws/aws_storage.py) | Cloud object storage for streaming synthesized `.mp3` audio tours and `.ics` calendar files, with 100% offline LocalStack emulation. |
| **AWS SAM CLI & Lambda** | [`aws-sam/template.yaml`](file:///d:/ECOLANE/aws-sam/template.yaml) | Serverless microservice architecture running the `PlumeDispersionFunction` Lambda for calculating smoke arrival times and API Gateway webhooks. |
| **AWS Finch & Corretto 21** | [`finch-compose.yml`](file:///d:/ECOLANE/finch-compose.yml)<br>`Dockerfile`s | Open-source container runtime and development tool by AWS, running Backend, Frontend, and OpenSearch with Amazon Corretto 21 OpenJDK. |

### 2. Zero-Config Local Fallback Engine (Adapter Pattern)
Every AWS service is wrapped in an **Adapter + Feature-Flag Pattern**. If external AWS credentials or LocalStack containers are not active, native Python math models, SQLite databases, and local storage activate automatically with zero downtime. Hackathon evaluators can clone and run the repo in seconds.

---

## 🏗️ Architecture & Project Structure

```
d:\ECOLANE\
├── Backend/                       # FastAPI REST API & Environmental Core
│   ├── app/
│   │   ├── agents/                # Agno Multi-Agent teams (Travel Planner & Audio Tour)
│   │   ├── aws/                   # AWS Adapters (OpenSearch, Cedar, S3/LocalStack, Bedrock)
│   │   ├── environmental/         # Live ingestion (OpenAQ, Open-Meteo, NASA EONET, WAQI)
│   │   ├── ml/                    # Gaussian Process Regression (GPR) spatial interpolation
│   │   ├── policies/              # AWS Cedar policy specifications (pediatric_safety.cedar)
│   │   ├── routes/                # Route generation, active rerouting, audio tour, travel APIs
│   │   ├── segments/              # Segment-level EcoScore and pollution scoring
│   │   ├── exposure/              # Human inhalation dose calculation engine
│   │   ├── dashboard/             # Lifetime exposure & summary statistics
│   │   └── trips/                 # Trip logging, history, and retrospective analysis
│   ├── main.py                    # Server entrypoint and route registration
│   └── requirements.txt           # Python backend dependencies
├── Frontend/                      # React & TypeScript Web Application
│   ├── src/
│   │   ├── routes/
│   │   │   ├── map.tsx            # Live MapLibre GL navigation, overlays & plume radar
│   │   │   ├── travel-planner.tsx # Multi-agent AI Eco-Travel Planner UI & calendar export
│   │   │   ├── audio-tour.tsx     # 5-Agent AI Audio Tour Guide & MP3 streaming player
│   │   │   ├── assistant.tsx      # AI Environmental conversational assistant
│   │   │   ├── dashboard.*.tsx    # Exposure tracker, 24h forecast, and trip history
│   │   │   ├── profile.tsx        # Respiratory profile & asthma settings
│   │   │   └── summary.tsx        # Post-commute exposure savings card
│   └── package.json               # Web application dependencies
├── aws-sam/                       # AWS SAM CLI serverless Lambda plume template
└── finch-compose.yml              # AWS Finch multi-container specification
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v18+)
* [Python](https://www.python.org/) (v3.10+)
* *(Optional)* [AWS Finch](https://runfinch.com/) or [LocalStack](https://localstack.cloud/)

---

### 2. Backend Setup
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd Backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy the environment variables:
   ```bash
   copy .env.example .env
   # macOS/Linux:
   cp .env.example .env
   ```
5. Start the FastAPI server (runs with **100% zero-config local fallbacks**):
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   Interactive Swagger docs are live at [http://localhost:8000/docs](http://localhost:8000/docs).

---

### 3. Frontend Setup
1. In a separate terminal, navigate to the frontend directory:
   ```bash
   cd Frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment configuration:
   ```bash
   copy .env.example .env
   # macOS/Linux:
   cp .env.example .env
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   Open your browser at [http://localhost:8080/](http://localhost:8080/).

---

### 4. Running with the AWS Open-Source Stack (Optional)
To test the containerized microservices and serverless functions locally:
```bash
# Build and run containers using AWS Finch
finch compose -f finch-compose.yml up --build

# Or invoke the serverless plume calculation Lambda locally via AWS SAM CLI
cd aws-sam
sam local invoke PlumeDispersionFunction
```

---

## 👥 Authors & Credits

* **Neil Emmanuel Mathias**
* **Ancilla Teresa D'Souza**

*Team The Codefather — Built for Environmental Hacks (AWS & WeMakeDevs Track 01: Air).*
