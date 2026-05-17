#!/bin/sh
# Solo corre cuando el paquete se instala como dependencia de otro proyecto
# (no cuando se hace npm install dentro de payment-core mismo)
if [ "$INIT_CWD" != "$PWD" ]; then
  node dist/postinstall.js
fi
