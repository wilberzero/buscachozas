import random
import time
import os
import re
from datetime import datetime
from curl_cffi import requests
from bs4 import BeautifulSoup

class IdealistaScraperPremium:
    def __init__(self):
        # URL exacta con los filtros de Burgos proporcionada por el usuario
        self.base_url = "https://www.idealista.com"
        self.start_url = "https://www.idealista.com/venta-viviendas/burgos-burgos/con-precio-hasta_300000,metros-cuadrados-mas-de_100,de-tres-dormitorios,de-cuatro-cinco-habitaciones-o-mas,dos-banos,tres-banos-o-mas/"
        self.results_file = "burgos_idealista_final.txt"
        self.session = requests.Session()
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
        # Limpiar archivo anterior si existe
        if os.path.exists(self.results_file):
            os.remove(self.results_file)

    def ejecutar(self):
        current_url = self.start_url
        page_num = 1
        
        try:
            print(f"[*] Iniciando sesión en Idealista...")
            self.session.get(self.base_url, headers=self.headers, impersonate="safari15_5", timeout=20)
            time.sleep(random.uniform(5, 10))

            while current_url:
                print(f"\n[*] PROCESANDO PÁGINA {page_num}...")
                print(f"[*] URL: {current_url}")
                
                self.headers["referer"] = self.base_url if page_num == 1 else prev_url
                res = self.session.get(current_url, headers=self.headers, impersonate="safari15_5", timeout=30)

                if res.status_code != 200:
                    print(f"[!] Error {res.status_code} en página {page_num}. Es posible que se requiera Captcha.")
                    with open(f"debug_page_{page_num}.html", "w", encoding="utf-8") as f:
                        f.write(res.text)
                    break

                soup = BeautifulSoup(res.text, 'html.parser')
                anuncios = soup.select('article.item')
                
                if not anuncios:
                    print("[!] No se encontraron más anuncios. Fin del proceso.")
                    break

                print(f"[+] Encontrados {len(anuncios)} anuncios en esta página.")
                self._extraer_y_guardar(anuncios)

                # Buscar enlace a la siguiente página
                next_page_elem = soup.select_one('li.next a')
                if next_page_elem and 'href' in next_page_elem.attrs:
                    prev_url = current_url
                    current_url = self.base_url + next_page_elem['href']
                    page_num += 1
                    
                    # RETRASO SOLICITADO: Entre 55 y 130 segundos
                    wait_time = random.randint(55, 130)
                    print(f"[*] Esperando {wait_time} segundos antes de la siguiente página para evitar bloqueos...")
                    time.sleep(wait_time)
                else:
                    print("[*] No hay más páginas disponibles.")
                    current_url = None

        except Exception as e:
            print(f"[-] Error crítico: {e}")

    def _extraer_y_guardar(self, anuncios):
        ahora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(self.results_file, "a", encoding="utf-8") as f:
            for anuncio in anuncios:
                try:
                    # Link y Título
                    link_elem = anuncio.select_one('.item-link')
                    if not link_elem: continue
                    titulo = link_elem.get_text().strip()
                    link = self.base_url + link_elem.get('href', '')
                    
                    # Precio
                    price_elem = anuncio.select_one('.item-price')
                    precio = price_elem.get_text().strip() if price_elem else "N/D"
                    
                    # Dirección / Zona
                    loc_elem = anuncio.select_one('.item-region')
                    direccion = loc_elem.get_text().strip() if loc_elem else "Burgos (ver mapa)"
                    
                    # CONTACTO / ANUNCIANTE (Profesional o Particular)
                    # 1. Intentamos buscar logo de inmobiliaria
                    brand_elem = anuncio.select_one('.logo-branding img')
                    if brand_elem:
                        contacto = brand_elem.get('title', brand_elem.get('alt', 'Empresa Profesional'))
                    else:
                        # 2. Si no hay logo, buscamos texto de contacto
                        contact_txt_elem = anuncio.select_one('.item-not-clickable-area span')
                        contacto = contact_txt_elem.get_text().strip() if contact_txt_elem else "Anunciante Particular"

                    # Detalles técnicos
                    details = " | ".join([d.get_text().strip() for d in anuncio.select('.item-detail')])

                    # Guardar en archivo
                    f.write(f"FECHA REGISTRO: {ahora}\n")
                    f.write(f"ANUNCIO: {titulo}\n")
                    f.write(f"PRECIO: {precio} | DETALLES: {details}\n")
                    f.write(f"DIRECCIÓN: {direccion}\n")
                    f.write(f"ANUNCIANTE: {contacto}\n")
                    f.write(f"URL: {link}\n")
                    f.write("-" * 60 + "\n")
                except Exception:
                    continue

if __name__ == "__main__":
    scraper = IdealistaScraperPremium()
    scraper.ejecutar()
