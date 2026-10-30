// Base URL of the FastAPI backend; set VITE_API_URL in .env for non-local deployments
export const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';
