# SHH Booking (React + Flask)

## Frontend

```
cd frontend
npm install
# ensure .env.local has REACT_APP_API_BASE_URL=http://localhost:3001
npm start
```

## Backend

```
cd backend
python -m ensurepip --upgrade
python -m pip install -r requirements.txt
# Create .env with your SF_SESSION_ID and SF_AVAIL_URL
python app.py
```

Open the project in VS Code by selecting the `shh_website_codebase` folder.