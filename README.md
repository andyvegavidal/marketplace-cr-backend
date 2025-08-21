# Marketplace CR - Aplicación Completa

Esta es la aplicación completa del marketplace que incluye tanto el backend como el frontend integrados.

## 📋 Requisitos Previos

- Node.js (versión 16 o superior)
- MongoDB (local o MongoDB Atlas)
- Git

## 🚀 Instalación y Configuración

### 1. Instalar dependencias del backend
```bash
cd marketplace-cr-backend
npm install
```

### 2. Instalar dependencias del frontend
```bash
cd ../marketplace-cr
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env` en el directorio `marketplace-cr-backend` con las siguientes variables:

```env
# Base de datos MongoDB
MONGODB_URI=tu_conexion_mongodb

# JWT Secret
JWT_SECRET=tu_jwt_secret_muy_seguro

# Cloudinary (para subida de imágenes)
CLOUDINARY_CLOUD_NAME=tu_cloudinary_name
CLOUDINARY_API_KEY=tu_cloudinary_api_key
CLOUDINARY_API_SECRET=tu_cloudinary_api_secret

# Puerto del servidor
PORT=5050
```

El frontend ya está configurado para conectarse al puerto 5050 del backend.

## 🏃‍♂️ Ejecución

### Opción 1: Ejecución completa (Producción)
```bash
cd marketplace-cr-backend
npm run build:install    # Instala dependencias del frontend y construye
npm start               # Inicia el servidor que sirve backend + frontend
```

### Opción 2: Desarrollo
```bash
cd marketplace-cr-backend
npm run dev:full        # Construye el frontend e inicia el backend en modo desarrollo
```

### Opción 3: Solo Backend (para desarrollo del API)
```bash
cd marketplace-cr-backend
npm run dev             # Solo inicia el backend en modo desarrollo
```

### Opción 4: Frontend y Backend por separado (desarrollo completo)
```bash
# Terminal 1 - Backend
cd marketplace-cr-backend
npm run dev

# Terminal 2 - Frontend
cd ../marketplace-cr
npm run dev
```

## 📁 Estructura de la aplicación

```
marketplace-cr-backend/          # Backend (Node.js + Express)
├── src/
│   ├── config/                 # Configuración de BD
│   ├── controllers/            # Controladores
│   ├── middleware/             # Middlewares
│   ├── models/                 # Modelos de MongoDB
│   └── routes/                 # Rutas del API
├── app.js                      # Archivo principal del servidor
└── package.json

marketplace-cr/                  # Frontend (React + Vite)
├── src/
│   ├── components/             # Componentes de React
│   ├── pages/                  # Páginas
│   ├── services/               # Servicios API
│   └── context/                # Context de React
├── dist/                       # Archivos construidos (generado)
└── package.json
```

## 🌐 Acceso a la aplicación

Una vez iniciado el servidor, puedes acceder a:

- **Aplicación completa**: http://localhost:5050
- **API Health Check**: http://localhost:5050/api/health
- **API Base**: http://localhost:5050/api/*

## 📊 Seeding de la Base de Datos

Para poblar la base de datos con datos de prueba:

```bash
cd marketplace-cr-backend
npm run seed
```

## 🛠️ Comandos Útiles

```bash
# Construir solo el frontend
npm run build

# Construir e instalar dependencias del frontend
npm run build:install

# Ejecutar con construcción automática
npm run start:full

# Desarrollo con reconstrucción
npm run dev:full
```

## 🔧 Resolución de Problemas

### Error: ENOENT index.html
Si obtienes este error, asegúrate de haber construido el frontend:
```bash
npm run build
```

### Error de CORS
Si tienes problemas de CORS, verifica que las URLs en la configuración incluyan el puerto correcto (5050).

### Error de conexión API
Verifica que el archivo `.env` del frontend tenga:
```
VITE_BASE_API_URL=http://localhost:5050/api
```

## 🚀 Despliegue

Para desplegar en producción:

1. Construir el frontend: `npm run build`
2. Configurar las variables de entorno de producción
3. Ejecutar: `npm start`

El servidor servirá tanto el API como la aplicación React desde el mismo puerto.
