import time
import schedule
import subprocess
import os
from datetime import datetime

def ejecutar_scraper():
    print(f"[{datetime.now()}] 🚀 Iniciando ejecución programada...")
    try:
        # Ejecutamos el script de forma independiente
        resultado = subprocess.run(["/lsiopy/bin/python3", "/config/proyectos/buscapisos_v2/buscapisos_v3_supabase.py"], 
                                   capture_output=True, text=True)
        
        # Guardamos el log para que puedas verlo
        with open("/config/proyectos/buscapisos_v2/scraper.log", "a") as f:
            f.write(f"\n--- EJECUCIÓN {datetime.now()} ---\n")
            f.write(resultado.stdout)
            if resultado.stderr:
                f.write("\nERRORES:\n")
                f.write(resultado.stderr)
        
        print(f"[{datetime.now()}] ✅ Ejecución terminada. Log actualizado.")
    except Exception as e:
        print(f"[{datetime.now()}] ❌ Error lanzando el scraper: {e}")

# Programar cada día a las 09:00
schedule.every().day.at("09:00").do(ejecutar_scraper)

# Tarea de prueba para verificar que el lanzador está vivo (cada hora escribe un punto en consola)
def keep_alive():
    print(f"[{datetime.now()}] Lanzador activo y esperando a las 09:00...")

schedule.every().hour.do(keep_alive)

print(f"[*] Lanzador de BuscaChozas activado.")
print(f"[*] Hora actual del sistema: {datetime.now()}")
print(f"[*] Próxima ejecución programada: Todas las mañanas a las 09:00.")

# El bucle principal esperará a la hora señalada
while True:
    schedule.run_pending()
    time.sleep(60)
