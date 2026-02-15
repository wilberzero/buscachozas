'use client';

import { useState } from 'react';
import { Tables } from '@/lib/database.types';
import { actualizarConfig } from '../actions';

type ConfigBusqueda = Tables<'config_busqueda'>;

interface EditorConfigProps {
    config: ConfigBusqueda;
}

/**
 * Editor de configuración de búsqueda con formulario inline.
 */
export default function EditorConfig({ config }: EditorConfigProps) {
    const [abierto, setAbierto] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const handleSubmit = async (formData: FormData) => {
        setGuardando(true);
        try {
            await actualizarConfig(formData);
            setAbierto(false);
        } catch (error) {
            console.error('Error guardando configuración:', error);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div>
            {/* Botón para abrir/cerrar */}
            <button
                onClick={() => setAbierto(!abierto)}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-all"
            >
                <span>⚙️</span>
                Configuración de búsqueda
                <svg
                    className={`w-4 h-4 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Panel de configuración */}
            {abierto && (
                <form
                    action={handleSubmit}
                    className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 animate-in slide-in-from-top-2"
                >
                    <h3 className="text-white font-medium text-sm">Filtros de búsqueda</h3>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <CampoNumero
                            label="Mín. habitaciones"
                            name="min_habitaciones"
                            defaultValue={config.min_habitaciones}
                        />
                        <CampoNumero
                            label="Mín. baños"
                            name="min_banos"
                            defaultValue={config.min_banos}
                        />
                        <CampoNumero
                            label="Mín. metros²"
                            name="min_metros"
                            defaultValue={config.min_metros}
                        />
                    </div>

                    <div className="flex gap-6">
                        <CampoCheck
                            label="Garaje"
                            name="garaje"
                            defaultChecked={config.garaje}
                        />
                        <CampoCheck
                            label="Trastero"
                            name="trastero"
                            defaultChecked={config.trastero}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={guardando}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                            {guardando ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setAbierto(false)}
                            className="px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

function CampoNumero({
    label,
    name,
    defaultValue,
}: {
    label: string;
    name: string;
    defaultValue: number;
}) {
    return (
        <div>
            <label htmlFor={name} className="block text-xs text-slate-400 mb-1">
                {label}
            </label>
            <input
                id={name}
                type="number"
                name={name}
                defaultValue={defaultValue}
                min={0}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
        </div>
    );
}

function CampoCheck({
    label,
    name,
    defaultChecked,
}: {
    label: string;
    name: string;
    defaultChecked: boolean;
}) {
    return (
        <label className="flex items-center gap-2 cursor-pointer group">
            <input
                type="checkbox"
                name={name}
                defaultChecked={defaultChecked}
                className="w-4 h-4 rounded bg-white/5 border-white/20 text-blue-500 focus:ring-blue-500/50 focus:ring-offset-0"
            />
            <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                {label}
            </span>
        </label>
    );
}
