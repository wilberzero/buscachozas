import random
import time
import os
import re
import json
from datetime import datetime
from curl_cffi import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client

# --- CONFIGURACIÓN SUPABASE ---
SUPABASE_URL = 'https://orrxhxowxrvcvvgzvevp.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ycnhoeG93eHJ2Y3Z2Z3p2ZXZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM2ODExMSwiZXhwIjoyMDg5OTQ0MTExfQ.kghlbaUiOfRZhZTQnXA1dG7UjcUQyDhvh3KRttY3310'

class IdealistaScraperSupabase:
    def __init__(self):
        self.base_url = "https://www.idealista.com"
        self.start_url = "https://www.idealista.com/venta-viviendas/burgos-burgos/con-precio-hasta_300000,metros-cuadrados-mas-de_100,de-tres-dormitorios,de-cuatro-cinco-habitaciones-o-mas,dos-banos,tres-banos-o-mas/"
        self.session = requests.Session()
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.headers = {
            "authority": "www.idealista.com",
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "es-ES,es;q=0.9",
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Safari/605.1.15",
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "none",
            "sec-fetch-user": "?1",
        }
        self.seen_in_this_run = []
        self.log_id = None
        self.processed_count = 0
        self.errors_count = 0
        self.geocode_cache = {}

    def _geocode_address(self, address):
        if not address:
            return None, None
        if address in self.geocode_cache:
            return self.geocode_cache[address]
        
        try:
            clean_addr = address.split(',')[0].replace('º', '').replace('ª', '').strip()
            if 'barrio' in clean_addr.lower() and len(clean_addr) < 15:
                return None, None
            
            query = f"{clean_addr}, Burgos, Spain"
            headers = {"User-Agent": "BuscaChozasBot/1.0 (contacto@tudominio.com)"}
            res = requests.get(f"https://nominatim.openstreetmap.org/search?format=json&q={requests.utils.quote(query)}&limit=1", headers=headers, timeout=10)
            
            if res.status_code == 200:
                data = res.json()
                if data and len(data) > 0:
                    coords = (float(data[0]['lat']), float(data[0]['lon']))
                    self.geocode_cache[address] = coords
                    time.sleep(1.1) # Respetar rate limit de Nominatim
                    return coords
            else:
                print(f"[!] Error de Nominatim {res.status_code} para {address}")
        except Exception as e:
            print(f"[!] Error geocoding {address}: {e}")
        
        self.geocode_cache[address] = (None, None)
        time.sleep(1.1)
        return None, None

    def start_log(self):
        try:
            res = self.supabase.table('app_logs').insert({
                "status": "running",
                "message": "Iniciando scraper diario..."
            }).execute()
            if res.data:
                self.log_id = res.data[0]['id']
        except: pass

    def finish_log(self, status, message):
        if not self.log_id: return
        try:
            self.supabase.table('app_logs').update({
                "status": status,
                "message": message,
                "end_time": datetime.now().isoformat(),
                "items_processed": self.processed_count,
                "errors_count": self.errors_count
            }).eq('id', self.log_id).execute()
        except: pass

    def ejecutar(self):
        self.start_log()
        
        # Obtener URL configurada desde la base de datos
        try:
            config_res = self.supabase.table('config').select('scraper_url').eq('id', 1).execute()
            if config_res.data and config_res.data[0]['scraper_url']:
                self.start_url = config_res.data[0]['scraper_url']
                print(f"[*] URL cargada desde BD: {self.start_url}")
        except Exception as e:
            print(f"[!] Error cargando configuración: {e}. Usando URL por defecto.")

        current_url = self.start_url
        page_num = 1
        prev_url = self.base_url
        
        try:
            print(f"[*] Iniciando BuscaChozas Bot...")
            self.session.get(self.base_url, headers=self.headers, impersonate="safari15_5", timeout=20)
            time.sleep(random.uniform(5, 10))

            while current_url:
                print(f"[*] PROCESANDO PÁGINA {page_num}...")
                res = self.session.get(current_url, headers=self.headers, impersonate="safari15_5", timeout=30)

                if res.status_code != 200:
                    self.errors_count += 1
                    break

                soup = BeautifulSoup(res.text, 'html.parser')
                anuncios = soup.select('article.item')
                
                if not anuncios: break

                self._procesar_anuncios(anuncios)

                next_page_elem = soup.select_one('li.next a')
                if next_page_elem and 'href' in next_page_elem.attrs:
                    current_url = self.base_url + next_page_elem['href']
                    page_num += 1
                    time.sleep(random.randint(55, 130))
                else:
                    current_url = None

            self.finish_log("success", f"Completado: {self.processed_count} chozas revisadas.")

        except Exception as e:
            self.errors_count += 1
            self.finish_log("error", f"Error crítico: {str(e)}")

    def _procesar_anuncios(self, anuncios):
        for anuncio in anuncios:
            try:
                link_elem = anuncio.select_one('.item-link')
                if not link_elem: continue
                
                url_path = link_elem.get('href', '')
                match_id = re.search(r'/inmueble/(\d+)/', url_path)
                if not match_id: continue
                external_id = match_id.group(1)
                
                self.seen_in_this_run.append(external_id)
                self.processed_count += 1

                price_elem = anuncio.select_one('.item-price')
                precio_num = int(re.sub(r'[^\d]', '', price_elem.get_text())) if price_elem else None
                if not precio_num: continue

                # LÓGICA SUPABASE
                response = self.supabase.table('properties').select('id, lat').eq('external_id', external_id).execute()
                
                if len(response.data) > 0:
                    db_id = response.data[0]['id']
                    update_data = {
                        "last_seen_at": datetime.now().isoformat(),
                        "active": True
                    }
                    
                    # Intentar geocodificar retrospectivamente si no tiene latitud
                    if response.data[0].get('lat') is None:
                        tipo, direccion, barrio = self._parsear_titulo(link_elem.get_text().strip())
                        lat, lng = self._geocode_address(direccion)
                        if lat is not None:
                            update_data['lat'] = lat
                            update_data['lng'] = lng

                    self.supabase.table('properties').update(update_data).eq('id', db_id).execute()
                    
                    # Chequear precio
                    hist = self.supabase.table('price_history').select('price').eq('property_id', db_id).order('recorded_at', desc=True).limit(1).execute()
                    if hist.data and float(hist.data[0]['price']) != float(precio_num):
                        self.supabase.table('price_history').insert({"property_id": db_id, "price": precio_num}).execute()
                else:
                    # Insertar nuevo
                    tipo, direccion, barrio = self._parsear_titulo(link_elem.get_text().strip())
                    details_raw = " | ".join([d.get_text().strip() for d in anuncio.select('.item-detail')])
                    rooms, size_m2, floor = self._parsear_detalles(details_raw)
                    
                    # Geocodificar en el momento de crear
                    lat, lng = self._geocode_address(direccion)
                    
                    prop_data = {
                        "external_id": external_id,
                        "title": link_elem.get_text().strip(),
                        "type": tipo, "address": direccion, "neighborhood": barrio,
                        "rooms": rooms, "size_m2": size_m2, "floor": floor,
                        "advertiser": "Profesional", "url": self.base_url + url_path, "active": True,
                        "lat": lat, "lng": lng
                    }
                    res = self.supabase.table('properties').insert(prop_data).execute()
                    if res.data:
                        self.supabase.table('price_history').insert({"property_id": res.data[0]['id'], "price": precio_num}).execute()

            except Exception as e: 
                print(f"[!] Error procesando anuncio: {e}")
                self.errors_count += 1

    def _parsear_precio(self, p): return int(re.sub(r'[^\d]', '', p)) if p else None
    def _parsear_titulo(self, t): 
        parts = t.split(" en ")
        tipo = parts[0]
        resto = parts[1] if len(parts)>1 else ""
        z = resto.split(",")
        return tipo, z[0] if len(z)>0 else "", z[1] if len(z)>1 else ""
    def _parsear_detalles(self, d):
        r, s, f = None, None, None
        if 'hab.' in d:
            m = re.search(r'(\d+)', d)
            if m: r = int(m.group(1))
        if 'm²' in d:
            m = re.search(r'([\d\.,]+)', d)
            if m: s = float(m.group(1).replace('.','').replace(',','.'))
        return r, s, f

if __name__ == "__main__":
    scraper = IdealistaScraperSupabase()
    scraper.ejecutar()
