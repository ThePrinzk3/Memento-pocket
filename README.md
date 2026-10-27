# Memento Pocket - Guía de Instalación y Prompt de Diseño

Esta guía te permite migrar y ejecutar todo el proyecto del Memento Pocket (Frontend, Servidor simulador ESP32 con SQLite y la Base de Datos integrada) en cualquier otra computadora o laptop de forma limpia y rápida.

## 🛠️ Requisitos Previos en la Nueva Laptop

Antes de mover los archivos, asegúrate de tener instalado:
Node.js (Versión 18 o superior recomendada).
Un editor de código como Visual Studio Code.

## 🚀 Pasos para Ejecutar en Otra Computadora

## Paso 1: Configurar el Backend (Servidor y Base de Datos)
Copia la carpeta backend a la nueva laptop.
Abre una terminal (consola o la integrada de VS Code) y navega dentro de la carpeta backend:

cd backend

El comando único para instalar todas las dependencias:
Ejecuta el siguiente comando. Node.js leerá el package.json, comprobará qué paquetes faltan y los instalará todos de golpe (incluyendo Express, SQLite3, Cors y CryptoJS):

npm install

(Si en el futuro añades más librerías y quieres actualizar o recrear el archivo package.json automáticamente en base a tu código actual, puedes usar npm init -y seguido de npm install).

Inicia el servidor simulador del ESP32:

node server.js

Deberías ver en la terminal el mensaje: ESP32 Server ejecutándose en puerto 3000 y la conexión con la base de datos local SQLite.

## Paso 2: Ejecutar el Frontend (App Móvil)

Abre la carpeta frontend en tu navegador o en VS Code.
Haz doble clic en el archivo index.html (o ábrelo usando la extensión Live Server de VS Code).
¡Listo! La app se conectará al servidor local de Node.js simulando la tarjeta MicroSD, la encriptación AES real, el localizador Buzzer y los modos de conexión WiFi / USB-C.

