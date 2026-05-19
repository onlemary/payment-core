#!/bin/sh
# Corre siempre: postinstall crea la base de datos si no existe.
# Idempotente: si la DB ya existe, no hace nada.
node dist/postinstall.js
