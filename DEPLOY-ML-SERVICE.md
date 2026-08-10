# Deploying the Python ML Microservice (FastAPI + Scikit-Learn)

This document provides step-by-step instructions to deploy the Python Machine Learning service to **Render** (Free Tier) or **Railway**, and connect it to your live Vercel frontend.

---

## 🚀 Option A: Deploy on Render.com (100% Free & Recommended)

Render provides free hosting for Python FastAPI Web Services.

### Steps:
1. **Push your code** to GitHub.
2. Go to **[Render Dashboard](https://dashboard.render.com)** and click **New +** → **Web Service**.
3. Connect your GitHub repository.
4. Fill in the following settings:
   - **Name**: `pageland-ml-service` (or any name you prefer)
   - **Environment**: `Python 3`
   - **Region**: Pick the closest region to your users
   - **Branch**: `main`
   - **Root Directory**: `python_ml`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`
5. Click **Create Web Service**.
6. Render will build and deploy your service. Once deployed, copy the service URL (e.g. `https://pageland-ml-service.onrender.com`).

---

## 🛠️ Option B: Deploy on Railway.app

1. Go to **[Railway.app](https://railway.app)** and create a **New Project** → **Deploy from GitHub repo**.
2. Select your repository.
3. Set the **Root Directory** setting to `python_ml` (or leave as root with `Procfile`).
4. Railway will automatically detect Python, install `python_ml/requirements.txt`, and start Uvicorn.
5. Generate a Public Domain under **Settings** → **Networking** (e.g. `https://pageland-ml-service.up.railway.app`).

---

## 🔗 Connecting the Deployed Microservice to Vercel

Once your Python ML microservice is deployed and online:

1. Copy your live ML API URL (e.g., `https://pageland-ml-service.onrender.com`).
2. Go to **Vercel Dashboard** → Select your frontend project → **Settings** → **Environment Variables**.
3. Add a new variable:
   - **Key**: `VITE_ML_API_URL`
   - **Value**: `https://pageland-ml-service.onrender.com` (or your deployed URL without trailing slash)
   - **Target**: Production, Preview, Development
4. Click **Save** and trigger a **Redeploy** on Vercel.

---

## ✅ Verification

1. Open your live microservice health endpoint in browser: `https://pageland-ml-service.onrender.com/health`
2. You should see JSON response:
   ```json
   {
     "status": "online",
     "models_loaded": {
       "risk_model": true,
       "cgpa_model": true,
       "scaler": true
     }
   }
   ```
3. Open your live app in Vercel. Perform a prediction query in the AI Warning System panel. The live Python scikit-learn models will process the request!
