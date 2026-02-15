import { procesarPiso, ResultadoProcesamiento } from './dbService';
import { PisoParsed } from './types';

// ============================================================
// Helper para crear un mock del cliente Supabase
// ============================================================

function crearMockSupabase(pisosDB: Record<string, any> = {}, historicoDB: any[] = []) {
    const mockClient: any = {
        from: (tabla: string) => {
            if (tabla === 'pisos') {
                return {
                    select: () => ({
                        eq: (_campo: string, valor: string) => ({
                            maybeSingle: async () => {
                                const found = Object.values(pisosDB).find((p: any) => p.portal_id === valor);
                                return { data: found || null, error: null };
                            },
                        }),
                    }),
                    insert: (datos: any) => ({
                        select: () => ({
                            single: async () => {
                                const id = `uuid-${Date.now()}-${Math.random()}`;
                                const piso = { ...datos, id, updated_at: new Date().toISOString() };
                                pisosDB[id] = piso;
                                return { data: piso, error: null };
                            },
                        }),
                    }),
                    update: (datos: any) => ({
                        eq: (campo: string, valor: string) => {
                            const found = Object.values(pisosDB).find((p: any) => p[campo] === valor);
                            if (found) {
                                Object.assign(found, datos);
                            }
                            return Promise.resolve({ data: found || null, error: null });
                        },
                    }),
                };
            }
            if (tabla === 'historico_precios') {
                return {
                    insert: (datos: any) => {
                        historicoDB.push(datos);
                        return Promise.resolve({ data: datos, error: null });
                    },
                };
            }
            return {};
        },
    };

    return mockClient;
}

function crearMockSupabaseConError() {
    const mockClient: any = {
        from: () => ({
            select: () => ({
                eq: () => ({
                    maybeSingle: async () => ({
                        data: null,
                        error: { message: 'Database connection error' },
                    }),
                }),
            }),
        }),
    };
    return mockClient;
}

// ============================================================
// Datos de prueba
// ============================================================

const pisoNuevo: PisoParsed = {
    portal_id: 'idealista-11111',
    titulo: 'Piso nuevo en centro Burgos',
    precio: 180000,
    metros: 90,
    habitaciones: 3,
    banos: 2,
    descripcion: 'Precioso piso con garaje y trastero',
    url_anuncio: 'https://www.idealista.com/inmueble/11111/',
    foto_principal: 'https://img.idealista.com/foto11111.jpg',
    garaje: true,
    trastero: true,
};

const pisoExistente = {
    id: 'uuid-existente-123',
    portal_id: 'idealista-22222',
    titulo: 'Piso existente',
    precio: 150000,
    metros: 75,
    habitaciones: 2,
    banos: 1,
    descripcion: 'Piso existente en la DB',
    url_anuncio: 'https://www.idealista.com/inmueble/22222/',
    foto_principal: 'https://img.idealista.com/foto22222.jpg',
    activo: true,
    updated_at: '2024-01-01T00:00:00Z',
};

// ============================================================
// TESTS
// ============================================================

describe('procesarPiso - Servicio de Base de Datos', () => {

    // ----------------------------------------------------------
    // Caso A: Piso NUEVO - no existe en la DB
    // ----------------------------------------------------------
    test('Caso A: Inserta un piso nuevo y registra su precio en histórico', async () => {
        const pisosDB: Record<string, any> = {};
        const historicoDB: any[] = [];
        const mockClient = crearMockSupabase(pisosDB, historicoDB);

        const resultado = await procesarPiso(pisoNuevo, mockClient);

        expect(resultado.tipo).toBe('NUEVO');
        expect(resultado.portal_id).toBe('idealista-11111');

        // Debe haber un piso en la DB simulada
        expect(Object.keys(pisosDB).length).toBe(1);

        // Verificar que se registró el precio en histórico
        expect(historicoDB.length).toBe(1);
        expect(historicoDB[0].precio).toBe(180000);
    });

    // ----------------------------------------------------------
    // Caso B: Piso existe y CAMBIÓ de precio
    // ----------------------------------------------------------
    test('Caso B: Detecta cambio de precio y actualiza el piso y el histórico', async () => {
        const pisosDB: Record<string, any> = {
            'uuid-existente-123': { ...pisoExistente },
        };
        const historicoDB: any[] = [];
        const mockClient = crearMockSupabase(pisosDB, historicoDB);

        const pisoConNuevoPrecio: PisoParsed = {
            portal_id: 'idealista-22222',
            titulo: 'Piso existente',
            precio: 140000, // Bajó de 150k a 140k
            metros: 75,
            habitaciones: 2,
            banos: 1,
            descripcion: 'Piso existente en la DB',
            url_anuncio: 'https://www.idealista.com/inmueble/22222/',
            foto_principal: 'https://img.idealista.com/foto22222.jpg',
            garaje: false,
            trastero: false,
        };

        const resultado = await procesarPiso(pisoConNuevoPrecio, mockClient);

        expect(resultado.tipo).toBe('CAMBIO_PRECIO');
        expect(resultado.portal_id).toBe('idealista-22222');
        expect(resultado.precioAnterior).toBe(150000);
        expect(resultado.precioNuevo).toBe(140000);

        // Verificar que se registró en histórico
        expect(historicoDB.length).toBe(1);
        expect(historicoDB[0].precio).toBe(140000);
    });

    // ----------------------------------------------------------
    // Caso C: Piso existe y NO cambió de precio
    // ----------------------------------------------------------
    test('Caso C: No hace cambios si el precio es igual, solo actualiza updated_at', async () => {
        const pisosDB: Record<string, any> = {
            'uuid-existente-123': { ...pisoExistente },
        };
        const historicoDB: any[] = [];
        const mockClient = crearMockSupabase(pisosDB, historicoDB);

        const pisoSinCambios: PisoParsed = {
            portal_id: 'idealista-22222',
            titulo: 'Piso existente',
            precio: 150000, // Mismo precio
            metros: 75,
            habitaciones: 2,
            banos: 1,
            descripcion: 'Piso existente en la DB',
            url_anuncio: 'https://www.idealista.com/inmueble/22222/',
            foto_principal: 'https://img.idealista.com/foto22222.jpg',
            garaje: false,
            trastero: false,
        };

        const resultado = await procesarPiso(pisoSinCambios, mockClient);

        expect(resultado.tipo).toBe('SIN_CAMBIOS');
        expect(resultado.portal_id).toBe('idealista-22222');

        // No se debe haber insertado nada en histórico
        expect(historicoDB.length).toBe(0);
    });

    // ----------------------------------------------------------
    // Manejo de errores
    // ----------------------------------------------------------
    test('Devuelve tipo ERROR si la consulta a la DB falla', async () => {
        const mockClient = crearMockSupabaseConError();

        const resultado = await procesarPiso(pisoNuevo, mockClient);
        expect(resultado.tipo).toBe('ERROR');
        expect(resultado.error).toBeTruthy();
    });

    test('El resultado siempre incluye portal_id', async () => {
        const mockClient = crearMockSupabase();

        const resultado = await procesarPiso(pisoNuevo, mockClient);
        expect(resultado.portal_id).toBe(pisoNuevo.portal_id);
    });
});
