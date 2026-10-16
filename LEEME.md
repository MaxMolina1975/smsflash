# Plataforma SMS (Vercel)

Plataforma web para enviar SMS desde tu celular Android, con enlaces que muestran tarjeta de vista previa (imagen, título y descripción).

## Cómo funciona

Vercel está en la nube y no puede hablar con la IP local de tu celular. Por eso se usa el **modo Nube** de la app SMS Gateway for Android: la plataforma le manda el pedido al servidor de la app y este avisa a tu celular, que envía el SMS con tu chip.

## 1. Celular

1. Instalá **SMS Gateway for Android** (capcom6, open source) y dale permiso de SMS.
2. En la pantalla de inicio de la app vas a ver un usuario y una contraseña (activá **Cloud Server** si te lo pide). Anotalos.
3. El celular tiene que tener internet (datos o Wi-Fi) y la app sin restricciones de batería.

## 2. Subir a Vercel

1. Subí esta carpeta a un repositorio de GitHub (o usá `vercel` desde la terminal).
2. En Vercel: Add New > Project, elegí el repo. Framework Preset: **Other**. No hace falta build.
3. En Settings > Environment Variables cargá:
   - `SMSGATE_USER` y `SMSGATE_PASS`: los datos del paso 1
   - `SESSION_SECRET`: un texto largo al azar (obligatorio para entrar con Google)
   - `GOOGLE_CLIENT_ID` y `ALLOWED_EMAILS`: ver el paso 2b
   - `APP_PASSWORD` (opcional): contraseña de respaldo. Si no la cargás, solo se entra con Google
4. Deploy.

## 2b. Entrar con Google (tu misma cuenta de Mensajes)

Google Messages web no tiene usuario y contraseña (se vincula con QR), así que el acceso se hace con "Iniciar sesión con Google". Solo entran los mails que pongas en `ALLOWED_EMAILS`.

1. Entrá a console.cloud.google.com y creá un proyecto (o usá uno existente).
2. APIs y servicios > Pantalla de consentimiento de OAuth: tipo **Externo**, completá nombre y tu mail. Dejalo en modo "Testing" y agregá tu mail en **Usuarios de prueba**.
3. Credenciales > Crear credenciales > **ID de cliente de OAuth** > tipo **Aplicación web**.
4. En **Orígenes de JavaScript autorizados** poné la URL de tu app (`https://tu-app.vercel.app`, y tu dominio propio si tenés). No hace falta URI de redireccionamiento.
5. Copiá el ID de cliente (termina en `.apps.googleusercontent.com`) a `GOOGLE_CLIENT_ID` en Vercel.
6. En `ALLOWED_EMAILS` poné tu mail de Google (varios separados por coma).
7. Redeploy.

## 3. Enlaces cortos (recomendado)

Sin base de datos, el enlace de vista previa viaja codificado y es largo. Para tener enlaces cortos tipo `tudominio.com/c/k3f9a2x`:

1. En Vercel: Storage > Create > **Upstash Redis** (plan gratis) y conectalo al proyecto.
2. Redeploy. Las variables se cargan solas.

## 4. Imágenes de las tarjetas

Poné las imágenes en `public/img/` (por ejemplo `public/img/sabado.jpg`, 1200x630 px, menos de 1 MB). Quedan en `https://tudominio.com/img/sabado.jpg`. Esa es la URL que va en el campo Imagen.

## Uso

1. Entrá con Google (o con la contraseña, si la cargaste). Arriba tiene que decir "Celular conectado".
2. Cargá el Excel (nombre y teléfono).
3. Completá título, descripción, imagen y destino, y tocá **Crear enlace**.
4. Escribí el mensaje. El enlace se agrega al final solo.
5. Probá primero con tu propio número. Después tocá **Enviar**.

## Notas

- Dejá la pestaña abierta mientras se envía. Las pausas entre mensajes las maneja el navegador.
- La tarjeta la dibuja el celular de quien recibe (Mensajes de Google con vistas previas activadas). No se puede forzar.
- Usá tu propio dominio y no acortadores tipo bit.ly: muchas veces no generan tarjeta y las operadoras desconfían.
- Las tildes hacen que cada SMS sea de 70 caracteres en vez de 160. El contador te avisa.
- Enviá solo a gente que te dio su número, en tandas chicas y con pausas largas, para cuidar tu línea.
