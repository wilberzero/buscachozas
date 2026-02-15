import { parseProperty, parseListPage } from './parser';

// ============================================================
// Mock HTML de una tarjeta individual de Idealista
// ============================================================
const mockTarjetaCompleta = `
<article class="item-multimedia-container" data-adid="idealista-12345">
  <div class="item-info-container">
    <a class="item-link" href="/inmueble/12345/" title="Piso en calle ejemplo 5, Burgos">
      Piso en calle ejemplo 5, Burgos
    </a>
    <span class="item-price h2-simulated">185.000€</span>
    <div class="item-detail-char">
      <span class="item-detail">3 hab.</span>
      <span class="item-detail">95 m²</span>
      <span class="item-detail">2 baños</span>
    </div>
    <div class="item-description description">
      Magnífico piso en zona centro de Burgos. Cuenta con garaje incluido y 
      trastero en el sótano. Luminoso y bien orientado.
    </div>
    <img class="item-multimedia" src="https://img3.idealista.com/foto12345.jpg" />
  </div>
</article>
`;

const mockTarjetaSinExtras = `
<article class="item-multimedia-container" data-adid="idealista-67890">
  <div class="item-info-container">
    <a class="item-link" href="/inmueble/67890/" title="Apartamento en avenida del Cid, Burgos">
      Apartamento en avenida del Cid, Burgos
    </a>
    <span class="item-price h2-simulated">120.000€</span>
    <div class="item-detail-char">
      <span class="item-detail">2 hab.</span>
      <span class="item-detail">65 m²</span>
      <span class="item-detail">1 baño</span>
    </div>
    <div class="item-description description">
      Apartamento reformado en zona tranquila. 
      Cerca de colegios y centros comerciales.
    </div>
    <img class="item-multimedia" src="https://img3.idealista.com/foto67890.jpg" />
  </div>
</article>
`;

const mockTarjetaSinPrecio = `
<article class="item-multimedia-container" data-adid="idealista-99999">
  <div class="item-info-container">
    <a class="item-link" href="/inmueble/99999/" title="Piso en calle sin precio">
      Piso en calle sin precio
    </a>
    <span class="item-price h2-simulated">A consultar</span>
    <div class="item-detail-char">
      <span class="item-detail">4 hab.</span>
      <span class="item-detail">110 m²</span>
    </div>
    <div class="item-description description">
      Piso amplio sin datos de precio. Con garaje privado.
    </div>
  </div>
</article>
`;

const mockTarjetaIncompleta = `
<article class="item-multimedia-container" data-adid="idealista-11111">
  <div class="item-info-container">
    <a class="item-link" href="/inmueble/11111/" title="Piso mínimo">
      Piso mínimo
    </a>
    <span class="item-price h2-simulated">90.000€</span>
  </div>
</article>
`;

// Mock de una página completa de resultados con múltiples tarjetas
const mockPaginaListado = `
<html>
<body>
  <section class="items-container">
    ${mockTarjetaCompleta}
    ${mockTarjetaSinExtras}
    ${mockTarjetaSinPrecio}
  </section>
</body>
</html>
`;

// ============================================================
// TESTS
// ============================================================

describe('parseProperty - Parser de tarjetas individuales', () => {

    test('extrae correctamente todos los campos de una tarjeta completa', () => {
        const resultado = parseProperty(mockTarjetaCompleta, 'https://www.idealista.com');

        expect(resultado).not.toBeNull();
        expect(resultado!.portal_id).toBe('idealista-12345');
        expect(resultado!.titulo).toBe('Piso en calle ejemplo 5, Burgos');
        expect(resultado!.precio).toBe(185000);
        expect(resultado!.habitaciones).toBe(3);
        expect(resultado!.metros).toBe(95);
        expect(resultado!.banos).toBe(2);
        expect(resultado!.url_anuncio).toBe('https://www.idealista.com/inmueble/12345/');
        expect(resultado!.foto_principal).toBe('https://img3.idealista.com/foto12345.jpg');
        expect(resultado!.descripcion).toContain('Magnífico piso');
    });

    test('detecta "garaje" en la descripción', () => {
        const resultado = parseProperty(mockTarjetaCompleta, 'https://www.idealista.com');
        expect(resultado!.garaje).toBe(true);
    });

    test('detecta "trastero" en la descripción', () => {
        const resultado = parseProperty(mockTarjetaCompleta, 'https://www.idealista.com');
        expect(resultado!.trastero).toBe(true);
    });

    test('devuelve false para garaje/trastero si no aparecen en la descripción', () => {
        const resultado = parseProperty(mockTarjetaSinExtras, 'https://www.idealista.com');
        expect(resultado!.garaje).toBe(false);
        expect(resultado!.trastero).toBe(false);
    });

    test('devuelve precio 0 si no se puede parsear el precio', () => {
        const resultado = parseProperty(mockTarjetaSinPrecio, 'https://www.idealista.com');
        expect(resultado!.precio).toBe(0);
    });

    test('maneja datos faltantes sin lanzar excepción', () => {
        const resultado = parseProperty(mockTarjetaIncompleta, 'https://www.idealista.com');
        expect(resultado).not.toBeNull();
        expect(resultado!.portal_id).toBe('idealista-11111');
        expect(resultado!.precio).toBe(90000);
        expect(resultado!.habitaciones).toBeNull();
        expect(resultado!.metros).toBeNull();
        expect(resultado!.banos).toBeNull();
        expect(resultado!.foto_principal).toBeNull();
    });

    test('devuelve null para HTML vacío o sin estructura válida', () => {
        const resultado = parseProperty('<div>No data</div>', 'https://www.idealista.com');
        expect(resultado).toBeNull();
    });

    test('maneja correctamente precios con puntos de miles (formato europeo)', () => {
        const htmlConPuntos = `
    <article class="item-multimedia-container" data-adid="idealista-22222">
      <div class="item-info-container">
        <a class="item-link" href="/inmueble/22222/" title="Piso caro">Piso caro</a>
        <span class="item-price h2-simulated">1.250.000€</span>
        <div class="item-detail-char">
          <span class="item-detail">5 hab.</span>
          <span class="item-detail">200 m²</span>
          <span class="item-detail">3 baños</span>
        </div>
        <div class="item-description description">Chalet de lujo.</div>
      </div>
    </article>
    `;
        const resultado = parseProperty(htmlConPuntos, 'https://www.idealista.com');
        expect(resultado!.precio).toBe(1250000);
    });

    test('extrae la URL completa correctamente cuando el href es relativo', () => {
        const resultado = parseProperty(mockTarjetaCompleta, 'https://www.idealista.com');
        expect(resultado!.url_anuncio).toMatch(/^https:\/\//);
    });
});

describe('parseListPage - Parser de página de listado', () => {

    test('extrae múltiples tarjetas de una página de resultados', () => {
        const resultados = parseListPage(mockPaginaListado, 'https://www.idealista.com');
        expect(resultados).toHaveLength(3);
    });

    test('cada resultado tiene los campos obligatorios', () => {
        const resultados = parseListPage(mockPaginaListado, 'https://www.idealista.com');
        resultados.forEach(piso => {
            expect(piso.portal_id).toBeTruthy();
            expect(piso.titulo).toBeTruthy();
            expect(typeof piso.precio).toBe('number');
            expect(piso.url_anuncio).toBeTruthy();
            expect(typeof piso.garaje).toBe('boolean');
            expect(typeof piso.trastero).toBe('boolean');
        });
    });

    test('devuelve array vacío si la página no contiene tarjetas', () => {
        const resultados = parseListPage('<html><body>Sin resultados</body></html>', 'https://www.idealista.com');
        expect(resultados).toHaveLength(0);
    });

    test('ignora tarjetas que no se pueden parsear sin romper el resto', () => {
        const htmlConError = `
    <html><body><section class="items-container">
      ${mockTarjetaCompleta}
      <article class="item-multimedia-container"><div>Mal formado</div></article>
      ${mockTarjetaSinExtras}
    </section></body></html>
    `;
        const resultados = parseListPage(htmlConError, 'https://www.idealista.com');
        // Como mínimo debe parsear las 2 tarjetas válidas
        expect(resultados.length).toBeGreaterThanOrEqual(2);
    });
});
