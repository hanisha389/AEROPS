# AEROPS Backend (FastAPI)

## Run

```bash
cd Backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API Base URL

- http://localhost:8000/api

## Endpoints

- `GET /api/health`
- `GET /api/pin`
- `PUT /api/pin`
- `POST /api/pin/verify`
- `GET /api/pilots`
- `POST /api/pilots`
- `GET /api/engineers`
- `POST /api/engineers`
- `GET /api/aircraft`
- `POST /api/aircraft`
- `POST /api/add`
