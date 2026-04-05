import random
import time
import os
import re
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
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
        }
        self.seen_in_this_run = []
        self.processed_count = 0
        self.errors_count = 0
        self.geocode_cache = {}
        
        # Colecciones para el informe por email
        self.new_ads = []
        self.price_changes = []
        self.deleted_ads = []
        self.favorites_ids = []
        self.user_config = {}

    def _geocode_address(self, address):
        if not address: return None, None
        if address in self.geocode_cache: return self.geocode_cache[address]
        try:
            clean_addr = address.split(',')[0].replace('º', '').replace('ª', '').strip()
            query = f"{clean_addr}, Burgos, Spain"
            headers = {"User-Agent": "BuscaChozasBot/1.0"}
            res = requests.get(f"https://nominatim.openstreetmap.org/search?format=json&q={requests.utils.quote(query)}&limit=1", headers=headers, timeout=10)
            if res.status_code == 200:
                data = res.json()
                if data:
                    coords = (float(data[0]['lat']), float(data[0]['lon']))
                    self.geocode_cache[address] = coords
                    time.sleep(1.1)
                    return coords
        except: pass
        return None, None

    def _cargar_configuracion(self):
        try:
            res = self.supabase.table('config').select('*').eq('id', 1).execute()
            if res.data:
                self.user_config = res.data[0]
                if self.user_config.get('scraper_url'):
                    self.start_url = self.user_config['scraper_url']
            
            # Cargar IDs de favoritos para marcarlos en el email
            favs_res = self.supabase.table('favorites').select('property_id').execute()
            self.favorites_ids = [f['property_id'] for f in favs_res.data] if favs_res.data else []
        except Exception as e:
            print(f"[!] Error cargando config: {e}")

    def ejecutar(self):
        self._cargar_configuracion()
        current_url = self.start_url
        page_num = 1
        
        try:
            print(f"[*] Iniciando BuscaChozas Bot...")
            self.session.get(self.base_url, headers=self.headers, impersonate="safari15_5", timeout=20)
            time.sleep(random.uniform(2, 5))

            while current_url:
                print(f"[*] PROCESANDO PÁGINA {page_num}...")
                res = self.session.get(current_url, headers=self.headers, impersonate="safari15_5", timeout=30)
                if res.status_code != 200: break

                soup = BeautifulSoup(res.text, 'html.parser')
                anuncios = soup.select('article.item')
                if not anuncios: break

                self._procesar_anuncios(anuncios)

                next_page_elem = soup.select_one('li.next a')
                if next_page_elem and 'href' in next_page_elem.attrs:
                    current_url = self.base_url + next_page_elem['href']
                    page_num += 1
                    time.sleep(random.randint(30, 60))
                else:
                    current_url = None

            # --- NUEVA LÓGICA: VERIFICAR BAJAS ---
            self._verificar_bajas()
            
            # --- NUEVA LÓGICA: ENVIAR EMAIL ---
            self._enviar_notificaciones()

        except Exception as e:
            print(f"[!] Error crítico: {e}")

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

                price_elem = anuncio.select_one('.item-price')
                precio_num = int(re.sub(r'[^\d]', '', price_elem.get_text())) if price_elem else None
                if not precio_num: continue

                response = self.supabase.table('properties').select('*').eq('external_id', external_id).execute()
                
                if len(response.data) > 0:
                    prop = response.data[0]
                    db_id = prop['id']
                    
                    # Chequear cambio de precio
                    hist = self.supabase.table('price_history').select('price').eq('property_id', db_id).order('recorded_at', desc=True).limit(1).execute()
                    if hist.data and int(hist.data[0]['price']) != precio_num:
                        old_price = int(hist.data[0]['price'])
                        self.supabase.table('price_history').insert({"property_id": db_id, "price": precio_num}).execute()
                        self.price_changes.append({
                            "title": prop['title'],
                            "old": old_price,
                            "new": precio_num,
                            "url": prop['url'],
                            "is_fav": db_id in self.favorites_ids
                        })

                    self.supabase.table('properties').update({"last_seen_at": datetime.now().isoformat(), "active": True}).eq('id', db_id).execute()
                else:
                    # Nuevo anuncio
                    tipo, direccion, barrio = self._parsear_titulo(link_elem.get_text().strip())
                    lat, lng = self._geocode_address(direccion)
                    prop_data = {
                        "external_id": external_id, "title": link_elem.get_text().strip(),
                        "type": tipo, "address": direccion, "neighborhood": barrio,
                        "url": self.base_url + url_path, "active": True, "lat": lat, "lng": lng
                    }
                    res = self.supabase.table('properties').insert(prop_data).execute()
                    if res.data:
                        new_id = res.data[0]['id']
                        self.supabase.table('price_history').insert({"property_id": new_id, "price": precio_num}).execute()
                        self.new_ads.append({**prop_data, "price": precio_num})

            except Exception as e: print(f"Error procesando anuncio: {e}")

    def _verificar_bajas(self):
        print("[*] Verificando anuncios eliminados...")
        # Buscamos en la BD los que estaban activos pero no se han visto en esta pasada
        activas_db = self.supabase.table('properties').select('id, external_id, url, title').eq('active', True).execute()
        for p in activas_db.data:
            if p['external_id'] not in self.seen_in_this_run:
                # Visitamos la URL para confirmar
                try:
                    time.sleep(2)
                    res = self.session.get(p['url'], headers=self.headers, impersonate="safari15_5")
                    # Si da 404 o redirige a la home o sale "anuncio finalizado"
                    if res.status_code == 404 or "aviso_finalizado" in res.text or "ya no está publicado" in res.text:
                        self.supabase.table('properties').update({"active": False}).eq('id', p['id']).execute()
                        self.deleted_ads.append({
                            "title": p['title'],
                            "url": p['url'],
                            "is_fav": p['id'] in self.favorites_ids
                        })
                        print(f"[!] Baja confirmada: {p['title']}")
                except: pass

    def _enviar_notificaciones(self):
        email_destino = self.user_config.get('alert_email')
        if not email_destino or (not self.new_ads and not self.price_changes and not self.deleted_ads):
            print("[*] No hay cambios relevantes o email no configurado. No se envía correo.")
            return

        print(f"[*] Enviando resumen de cambios a {email_destino}...")
        
        cuerpo = "<h2>Resumen diario de BuscaChozas</h2>"
        
        if self.new_ads:
            cuerpo += "<h3>🚀 Nuevas Chozas Detectadas</h3><ul>"
            for a in self.new_ads:
                cuerpo += f"<li><b>{a['price']}€</b> - <a href='{a['url']}'>{a['title']}</a></li>"
            cuerpo += "</ul>"

        if self.price_changes:
            cuerpo += "<h3>💰 Cambios de Precio</h3><ul>"
            for c in self.price_changes:
                fav_tag = "<b style='color:red'>[⭐ FAVORITO]</b> " if c['is_fav'] else ""
                emoji = "📉" if c['new'] < c['old'] else "📈"
                cuerpo += f"<li>{fav_tag}{emoji} {c['old']}€ -> <b>{c['new']}€</b> - <a href='{c['url']}'>{c['title']}</a></li>"
            cuerpo += "</ul>"

        if self.deleted_ads:
            cuerpo += "<h3>🗑️ Anuncios Eliminados</h3><ul>"
            for d in self.deleted_ads:
                fav_tag = "<b style='color:red'>[⭐ FAVORITO]</b> " if d['is_fav'] else ""
                cuerpo += f"<li>{fav_tag}{d['title']}</li>"
            cuerpo += "</ul>"

        # Aquí intentamos enviar por SMTP si están los datos, si no, lo dejamos en el log
        try:
            msg = MIMEMultipart()
            msg['Subject'] = f"BuscaChozas: {len(self.new_ads)} nuevas, {len(self.price_changes)} cambios"
            msg['From'] = "BuscaChozas Bot <notificaciones@buscachozas.com>"
            msg['To'] = email_destino
            msg.attach(MIMEText(cuerpo, 'html'))

            # NOTA: Para que esto funcione, el usuario debe poner sus datos SMTP en la tabla 'config'
            if self.user_config.get('smtp_user') and self.user_config.get('smtp_pass'):
                server = smtplib.SMTP(self.user_config.get('smtp_server', 'smtp.gmail.com'), self.user_config.get('smtp_port', 587))
                server.starttls()
                server.login(self.user_config['smtp_user'], self.user_config['smtp_pass'])
                server.sendmail(self.user_config['smtp_user'], email_destino, msg.as_string())
                server.quit()
                print("[+] Email enviado con éxito.")
            else:
                print("[!] Email generado pero no enviado: Falta configurar SMTP en la tabla 'config'.")
        except Exception as e:
            print(f"[!] Error enviando email: {e}")

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
