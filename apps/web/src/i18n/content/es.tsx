import { Ext, LINKS, Mail, REPO, STUDIO, type Content } from './shared.tsx';

const sources = (
  <>
    <p>Las reglas de ligungi siguen, en este orden de autoridad:</p>
    <ol>
      <li>El libro de reglas oficial (軍儀解説書), publicado en 2022 por Universal Music junto con el tablero físico.</li>
      <li>
        Las <Ext href={LINKS.rulebookFaq}>preguntas frecuentes oficiales de Universal Music</Ext> (Q1 a Q30), que aclaran
        casos y corrigen una errata del libro.
      </li>
      <li>
        La <Ext href={LINKS.rulebookEnglish}>traducción del libro al inglés</Ext>, revisada página por página con el original.
      </li>
      <li>
        <Ext href={LINKS.gungiWeb}>軍儀Web</Ext>, un sitio japonés que sigue las reglas oficiales, usado solo donde el libro no
        dice nada.
      </li>
    </ol>
    <p>
      Cuando el libro deja dudas, la interpretación adoptada y el motivo están en la{' '}
      <Ext href={LINKS.spec}>especificación completa de las reglas</Ext>, en el código fuente del proyecto.
    </p>
  </>
);

export const es: Content = {
  updated: 'Última actualización: 12 de noviembre de 2026.',

  about: (
    <>
      <p>
        ligungi es una plataforma gratuita para jugar Gungi (軍儀), el juego de tablero de HUNTER×HUNTER, online y con las
        reglas oficiales de 2022. Sin anuncios, sin necesidad de cuenta y con código abierto.
      </p>
      <p>
        Lo hace <Ext href={STUDIO}>Beater Studios</Ext> y está inspirado en lichess.org: la interfaz reutiliza el diseño de
        lila, el código abierto de lichess.
      </p>
      <h2>Reglas</h2>
      {sources}
      <h2>Código abierto</h2>
      <p>
        Todo el código de ligungi está en <Ext href={REPO}>GitHub</Ext>, bajo la licencia{' '}
        <Ext href={LINKS.agpl}>GNU AGPL-3.0</Ext> o posterior. Las correcciones de reglas, traducciones y código son
        bienvenidos.
      </p>
      <h2>Créditos</h2>
      <ul>
        <li>
          Diseño: <Ext href={LINKS.lila}>lila</Ext>, el código abierto de lichess.org (AGPL-3.0).
        </li>
        <li>
          Sonidos: el conjunto "sfx" de Enigmahack y la fuente de iconos, ambos de lila (ver el{' '}
          <Ext href={LINKS.lilaCopying}>COPYING.md de lila</Ext>).
        </li>
        <li>
          Fuentes Noto Sans y Roboto, de Google, bajo la <Ext href={LINKS.ofl}>SIL Open Font License</Ext>.
        </li>
      </ul>
      <h2>Aviso</h2>
      <p>
        Gungi y HUNTER×HUNTER pertenecen a sus propietarios (Yoshihiro Togashi, Shueisha y Universal Music). ligungi es un
        proyecto de fans, sin afiliación oficial, y no usa personajes, ilustraciones ni logotipos de la obra.
      </p>
    </>
  ),

  faq: [
    {
      q: '¿Qué es el Gungi?',
      a: (
        <p>
          Un juego de estrategia para dos jugadores, creado para el manga HUNTER×HUNTER y publicado como juego real en 2022.
          Se parece al shogi, pero las piezas pueden apilarse en torres de hasta tres, y la altura de la torre aumenta el
          alcance de la pieza de arriba. Mira <a href="/learn">cómo jugar</a>.
        </p>
      ),
    },
    {
      q: '¿Las reglas son de verdad las oficiales?',
      a: (
        <p>
          Sí. Seguimos el libro de reglas de 2022 y las preguntas frecuentes oficiales de Universal Music. Las fuentes están
          en la página <a href="/about">Acerca de</a>, y cada punto ambiguo, con la interpretación elegida, está en la{' '}
          <Ext href={LINKS.spec}>especificación de las reglas</Ext>.
        </p>
      ),
    },
    {
      q: '¿Es gratis? ¿Necesito una cuenta?',
      a: (
        <p>
          Es gratis y sin anuncios. Puedes jugar sin cuenta; con una juegas partidas puntuables, entras en la clasificación,
          sigues a tus amigos y guardas el historial en tu perfil.
        </p>
      ),
    },
    {
      q: '¿Cómo funciona la puntuación?',
      a: (
        <p>
          Usamos Glicko-2, con una puntuación distinta para cada modo. Mientras la puntuación aún es incierta aparece con "?"
          y el jugador no entra en la clasificación. Las partidas casuales no cambian la puntuación.
        </p>
      ),
    },
    {
      q: '¿Por qué no puedo hacer una jugada que pone en peligro a mi Mariscal?',
      a: (
        <p>
          Según el libro, quien deja capturar a su Mariscal pierde. En lugar de permitir la jugada y esperar la captura, el
          sitio simplemente no la ofrece. Si no tienes ninguna jugada que deje a salvo a tu Mariscal, la partida termina en
          mate, aunque no esté atacado en ese momento.
        </p>
      ),
    },
    {
      q: '¿Qué son el draft y el "済み"?',
      a: (
        <p>
          En los modos Intermedio y Avanzado, cada jugador arma su propio ejército colocando piezas en su territorio, una por
          una, empezando por el Mariscal. "済み" significa "listo": quien lo declara no coloca más piezas. Según el libro,
          cuando el segundo jugador declara listo, el draft termina para los dos. En partidas casuales existe la opción
          "draft libre", en la que cada uno termina el suyo.
        </p>
      ),
    },
    {
      q: '¿Qué es FEN?',
      a: (
        <p>
          Una línea de texto que describe una posición completa: las torres del tablero, las piezas en la mano, a quién le
          toca, el modo y la fase. En el tablero de análisis puedes copiar y pegar posiciones con ella.
        </p>
      ),
    },
    {
      q: '¿ligungi tiene relación con HUNTER×HUNTER o con Universal Music?',
      a: <p>No. Es un proyecto de fans, sin afiliación oficial.</p>,
    },
    {
      q: 'Encontré un error. ¿Cómo aviso?',
      a: (
        <p>
          Abre un <Ext href={LINKS.issues}>issue en GitHub</Ext> o escribe a <Mail />. Para fallos de seguridad, usa el{' '}
          <Ext href={LINKS.security}>reporte privado</Ext>, nunca un issue público.
        </p>
      ),
    },
    {
      q: '¿Puedo ayudar?',
      a: (
        <p>
          Sí. El código es abierto y acepta contribuciones: correcciones de reglas con fuente, traducciones, código y
          reportes de errores. Empieza por el <Ext href={REPO}>repositorio</Ext>.
        </p>
      ),
    },
  ],

  contact: (
    <>
      <p>
        Para dudas, sugerencias, colaboraciones o solicitudes sobre tus datos, escribe a <Mail />.
      </p>
      <ul>
        <li>
          Errores y sugerencias técnicas: <Ext href={LINKS.issues}>issues en GitHub</Ext>.
        </li>
        <li>
          Fallos de seguridad: <Ext href={LINKS.security}>reporte privado en GitHub</Ext>, nunca en público.
        </li>
        <li>
          Privacidad y datos personales: <Mail />, mira la <a href="/privacy">política de privacidad</a>.
        </li>
      </ul>
    </>
  ),

  terms: (
    <>
      <p>
        Estas condiciones se aplican al uso de ligungi.org, mantenido por <Ext href={STUDIO}>Beater Studios</Ext>. Al usar el
        sitio, las aceptas.
      </p>
      <h2>El servicio</h2>
      <p>
        ligungi es gratuito y se ofrece tal cual, sin garantía de disponibilidad continua. Podemos cambiar, suspender o
        terminar funciones en cualquier momento.
      </p>
      <h2>Cuenta</h2>
      <ul>
        <li>Eres responsable de tu contraseña y de todo lo que se haga con tu cuenta.</li>
        <li>Usa un nombre de usuario que no sea ofensivo ni suplante a otra persona.</li>
        <li>Los menores de 13 años solo pueden crear una cuenta con permiso de sus padres o tutores.</li>
      </ul>
      <h2>Conducta</h2>
      <p>No está permitido:</p>
      <ul>
        <li>usar programas o ayuda de terceros durante partidas contra otras personas;</li>
        <li>manipular la puntuación, por ejemplo con cuentas múltiples o partidas arregladas;</li>
        <li>acosar, insultar o amenazar a otros jugadores;</li>
        <li>atacar, sobrecargar o intentar saltarse las protecciones del sitio.</li>
      </ul>
      <p>Las cuentas que incumplan estas reglas pueden ser suspendidas o eliminadas.</p>
      <h2>Partidas y perfil</h2>
      <p>
        Las partidas, resultados, puntuaciones y nombres de usuario son públicos: cualquiera puede ver y exportar las partidas
        jugadas en el sitio.
      </p>
      <h2>Código y marcas</h2>
      <p>
        El código de ligungi es abierto bajo la <Ext href={LINKS.agpl}>GNU AGPL-3.0</Ext>, que tiene sus propias reglas para
        quien copia o modifica el código. Gungi y HUNTER×HUNTER pertenecen a sus propietarios; ligungi es un proyecto de fans,
        sin afiliación oficial.
      </p>
      <h2>Responsabilidad</h2>
      <p>
        En la medida en que lo permita la ley, Beater Studios no se responsabiliza de pérdidas derivadas del uso o la falta
        de disponibilidad del sitio, como partidas interrumpidas o datos perdidos.
      </p>
      <h2>Cambios y contacto</h2>
      <p>
        Podemos actualizar estas condiciones; la fecha de arriba indica la versión vigente. Estas condiciones se rigen por la
        legislación brasileña. Dudas: <Mail />.
      </p>
    </>
  ),

  privacy: (
    <>
      <p>
        Esta política explica qué datos trata ligungi.org y por qué, de acuerdo con la Ley General de Protección de Datos de
        Brasil (LGPD). La responsable de los datos es <Ext href={STUDIO}>Beater Studios</Ext>. Contacto: <Mail />.
      </p>
      <h2>Resumen</h2>
      <ul>
        <li>Sin anuncios, sin rastreadores y sin cookies de terceros.</li>
        <li>Solo guardamos lo necesario para que el juego funcione.</li>
        <li>Tus datos no se venden ni se comparten con fines de marketing.</li>
      </ul>
      <h2>Qué tratamos</h2>
      <ul>
        <li>
          <b>Cuenta (si creas una):</b> nombre de usuario y contraseña. La contraseña solo se guarda cifrada (hash), y ni
          nosotros podemos leerla.
        </li>
        <li>
          <b>Partidas y actividad:</b> jugadas, resultados, puntuaciones, jugadores que sigues y la fecha de creación de la
          cuenta. Estos datos aparecen en tu perfil público.
        </li>
        <li>
          <b>Cookie de sesión (sid):</b> una cookie esencial que identifica tu navegador para mantener la sesión y tus
          partidas. No se usa para rastrear. Las sesiones sin cuenta caducan tras 30 días sin uso; con cuenta, tras un año.
        </li>
        <li>
          <b>Dirección IP:</b> se usa en el momento de la solicitud para limitar los intentos de inicio de sesión y proteger
          el sitio contra abusos. No se guarda en nuestra base de datos.
        </li>
        <li>
          <b>Estadísticas de visitas:</b> Cloudflare Web Analytics cuenta, de forma agregada, las páginas visitadas, el país,
          el tipo de navegador y el tiempo de carga. No usa cookies, no guarda nada en tu navegador y no te identifica. Solo
          se activa si lo aceptas en el aviso de cookies, y puedes cambiar tu elección al final de esta página.
        </li>
        <li>
          <b>Preferencias:</b> idioma, tema, sonido y tamaño del tablero quedan solo en tu navegador (almacenamiento local) y
          no se nos envían.
        </li>
      </ul>
      <h2>Por qué los tratamos (bases legales)</h2>
      <ul>
        <li>Cuenta, partidas y sesión: para prestar el servicio que pediste (ejecución de un contrato).</li>
        <li>IP y protecciones: interés legítimo en mantener el sitio seguro y en funcionamiento.</li>
        <li>Estadísticas de visitas: tu consentimiento, que puedes retirar en cualquier momento.</li>
      </ul>
      <h2>Con quién los compartimos</h2>
      <p>
        El tráfico del sitio pasa por Cloudflare, que ofrece una red de distribución de contenido (CDN), protección contra
        ataques y las estadísticas de visitas, y puede tratar datos técnicos, como la IP, incluso fuera de Brasil (mira la{' '}
        <Ext href={LINKS.cloudflarePrivacy}>política de Cloudflare</Ext>). El sitio funciona en un proveedor de alojamiento
        contratado por Beater Studios. Fuera de eso, solo compartimos datos si la ley lo exige.
      </p>
      <h2>Por cuánto tiempo</h2>
      <ul>
        <li>Cuenta y partidas: mientras exista la cuenta. Las partidas forman parte del historial público del sitio.</li>
        <li>Sesiones: hasta que caduquen, como se describe arriba.</li>
        <li>Copias de seguridad: hasta 14 días.</li>
      </ul>
      <h2>Tus derechos</h2>
      <p>
        Según la LGPD, puedes pedir acceso, corrección o eliminación de tus datos, e información sobre su tratamiento.
        Escribe a <Mail /> con el asunto "Privacidad", indicando tu nombre de usuario. Eliminar la cuenta borra tus datos
        personales; las partidas ya jugadas pueden quedar en el historial de forma anónima.
      </p>
      <h2>Cambios</h2>
      <p>Podemos actualizar esta política; la fecha de arriba indica la versión vigente.</p>
    </>
  ),

  sources,
};
