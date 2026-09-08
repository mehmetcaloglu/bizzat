#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,re,unicodedata
from collections import defaultdict,Counter
from pathlib import Path

BRANDS={
'fiat':('Fiat',['TOFAS-FIAT','FIAT']),'renault':('Renault',['RENAULT','RENAULT (OYAK)']),'volkswagen':('Volkswagen',['VOLKSWAGEN']),'opel':('Opel',['OPEL']),'peugeot':('Peugeot',['PEUGEOT']),'hyundai':('Hyundai',['HYUNDAI']),'toyota':('Toyota',['TOYOTA']),'citroen':('Citroën',['CITROEN']),'skoda':('Skoda',['SKODA']),'kia':('Kia',['KIA']),'dacia':('Dacia',['DACIA']),'nissan':('Nissan',['NISSAN']),'honda':('Honda',['HONDA']),'seat':('Seat',['SEAT']),'ford':('Ford',['FORD','FORD /USA']),'suzuki':('Suzuki',['SUZUKI']),'mazda':('Mazda',['MAZDA']),'chevrolet':('Chevrolet',['CHEVROLET']),'mitsubishi':('Mitsubishi',['MITSUBISHI']),'subaru':('Subaru',['SUBARU']),'tesla':('Tesla',['TESLA']),'byd':('BYD',['BYD']),'chery':('Chery',['CHERY']),'cupra':('Cupra',['CUPRA']),'ds':('DS Automobiles',['DS']),'alfa-romeo':('Alfa Romeo',['ALFA ROMEO']),'mini':('MINI',['MINI'])}
S={}
def add(b,k,n,*a): S[(b,k)]=(n,list(a))
for a in [('egea','Egea','EGEA','EGEA SEDAN','EGEA HATCHBACK','EGEA CROSS'),('linea','Linea','LINEA'),('punto','Punto','PUNTO','GRANDE PUNTO','PUNTO EVO'),('palio','Palio','PALIO'),('siena','Siena','SIENA'),('albea','Albea','ALBEA'),('500','500','500'),('500l','500L','500L'),('500x','500X','500X'),('bravo','Bravo','BRAVO'),('panda','Panda','PANDA'),('tipo','Tipo','TIPO'),('stilo','Stilo','STILO'),('marea','Marea','MAREA'),('brava','Brava','BRAVA')]: add('fiat',*a)
for a in [('clio','Clio','CLIO'),('megane','Megane','MEGANE','MEGANE SEDAN','MEGANE HATCHBACK'),('symbol','Symbol','SYMBOL'),('fluence','Fluence','FLUENCE'),('talisman','Talisman','TALISMAN'),('laguna','Laguna','LAGUNA'),('latitude','Latitude','LATITUDE'),('scenic','Scenic','SCENIC','GRAND SCENIC'),('captur','Captur','CAPTUR'),('austral','Austral','AUSTRAL'),('arkana','Arkana','ARKANA'),('zoe','Zoe','ZOE'),('modus','Modus','MODUS')]: add('renault',*a)
for a in [('golf','Golf','GOLF'),('polo','Polo','POLO'),('passat','Passat','PASSAT','PASSAT CC'),('jetta','Jetta','JETTA'),('bora','Bora','BORA'),('beetle','Beetle','BEETLE','NEW BEETLE'),('scirocco','Scirocco','SCIROCCO'),('arteon','Arteon','ARTEON'),('taigo','Taigo','TAIGO'),('t-cross','T-Cross','T-CROSS'),('t-roc','T-Roc','T-ROC'),('tiguan','Tiguan','TIGUAN'),('touareg','Touareg','TOUAREG'),('id3','ID.3','ID.3','ID3'),('id4','ID.4','ID.4','ID4'),('id5','ID.5','ID.5','ID5'),('id7','ID.7','ID.7','ID7'),('up','up!','UP!','UP'),('eos','Eos','EOS'),('cc','CC','CC'),('phaeton','Phaeton','PHAETON')]: add('volkswagen',*a)
for a in [('astra','Astra','ASTRA'),('corsa','Corsa','CORSA'),('insignia','Insignia','INSIGNIA'),('vectra','Vectra','VECTRA'),('omega','Omega','OMEGA'),('zafira','Zafira','ZAFIRA'),('mokka','Mokka','MOKKA'),('crossland','Crossland','CROSSLAND','CROSSLAND X'),('grandland','Grandland','GRANDLAND','GRANDLAND X'),('adam','Adam','ADAM'),('meriva','Meriva','MERIVA'),('tigra','Tigra','TIGRA'),('cascada','Cascada','CASCADA'),('frontera','Frontera','FRONTERA')]: add('opel',*a)
for x in ['106','107','108','205','206','207','208','301','306','307','308','406','407','408','508','2008','3008','4008','5008','RCZ']: add('peugeot',x.lower(),x,x)
for a in [('i10','i10','I10'),('i20','i20','I20'),('i30','i30','I30'),('i40','i40','I40'),('accent','Accent','ACCENT','ACCENT BLUE','ACCENT ERA'),('elantra','Elantra','ELANTRA'),('getz','Getz','GETZ'),('matrix','Matrix','MATRIX'),('sonata','Sonata','SONATA'),('tucson','Tucson','TUCSON'),('santa-fe','Santa Fe','SANTA FE'),('bayon','Bayon','BAYON'),('kona','Kona','KONA'),('ioniq','Ioniq','IONIQ'),('ioniq5','Ioniq 5','IONIQ 5'),('ioniq6','Ioniq 6','IONIQ 6'),('atos','Atos','ATOS'),('coupe','Coupe','COUPE'),('ix20','ix20','IX20'),('ix35','ix35','IX35'),('ix55','ix55','IX55')]: add('hyundai',*a)
for a in [('corolla','Corolla','COROLLA','COROLLA CROSS'),('yaris','Yaris','YARIS','YARIS CROSS'),('auris','Auris','AURIS'),('avensis','Avensis','AVENSIS'),('camry','Camry','CAMRY'),('c-hr','C-HR','C-HR','CHR'),('rav4','RAV4','RAV4','RAV 4'),('prius','Prius','PRIUS'),('verso','Verso','VERSO','COROLLA VERSO'),('aygo','Aygo','AYGO'),('gt86','GT86','GT86'),('supra','Supra','SUPRA'),('urban-cruiser','Urban Cruiser','URBAN CRUISER')]: add('toyota',*a)
for x in ['C1','C2','C3','C3 AIRCROSS','C4','C4 X','C4 CACTUS','C4 PICASSO','C5','C5 AIRCROSS','C5 X','C6','C-ELYSEE','XSARA','XSARA PICASSO','SAXO','XANTIA','DS3','DS4','DS5']: add('citroen',x.lower().replace(' ','-'),x,x)
for x in ['FABIA','OCTAVIA','SUPERB','RAPID','SCALA','KAMIQ','KAROQ','KODIAQ','YETI','ROOMSTER','CITIGO','ENYAQ']: add('skoda',x.lower().replace(' ','-'),x.title() if x!='ENYAQ' else 'Enyaq',x)
for x in ['PICANTO','RIO','CEED','CERATO','SPORTAGE','SORENTO','STONIC','NIRO','SOUL','OPTIMA','MAGENTIS','CARENS','PROCEED','EV3','EV6','EV9']: add('kia',x.lower().replace(' ','-'),x.title() if not x.startswith('EV') else x,x)
for x in ['LOGAN','SANDERO','DUSTER','LODGY','JOGGER','SPRING']: add('dacia',x.lower(),x.title(),x)
for x in ['MICRA','ALMERA','PRIMERA','QASHQAI','JUKE','X-TRAIL','NOTE','PULSAR','TIIDA','350Z','370Z','LEAF']: add('nissan',x.lower().replace(' ','-'),x.title() if x not in ['X-TRAIL','350Z','370Z'] else x,x)
for x in ['CIVIC','ACCORD','JAZZ','CITY','CR-V','HR-V','CR-Z','INSIGHT','PRELUDE','S2000']: add('honda',x.lower().replace(' ','-'),x.title() if '-' not in x else x,x)
for x in ['IBIZA','LEON','TOLEDO','CORDOBA','ALTEA','ATECA','ARONA','TARRACO','EXEO','MII']: add('seat',x.lower(),x.title(),x)
for x in ['FOCUS','FIESTA','MONDEO','KA','FUSION','B-MAX','C-MAX','PUMA','MUSTANG','KUGA','ECOSPORT','EDGE']: add('ford',x.lower().replace(' ','-'),x.title() if '-' not in x else x,x)
for x in ['SWIFT','VITARA','SX4','S-CROSS','BALENO','JIMNY','IGNIS','ALTO','SPLASH','LIANA']: add('suzuki',x.lower().replace(' ','-'),x.title() if '-' not in x else x,x)
for x in ['MAZDA2','MAZDA3','MAZDA5','MAZDA6','CX-3','CX-30','CX-5','CX-60','CX-7','MX-5','RX-8']: add('mazda',x.lower(),x,x)
for x in ['AVEO','CAPTIVA','CRUZE','EPICA','KALOS','LACETTI','MALIBU','REZZO','SONIC','SPARK','TRAX','VOLT','CAMARO','CORVETTE']: add('chevrolet',x.lower(),x.title(),x)
for x in ['COLT','LANCER','ASX','OUTLANDER','ECLIPSE CROSS','SPACE STAR','PAJERO']: add('mitsubishi',x.lower().replace(' ','-'),x.title(),x)
for x in ['IMPREZA','LEGACY','FORESTER','OUTBACK','XV','BRZ','LEVORG']: add('subaru',x.lower(),x.title(),x)
for x in ['MODEL 3','MODEL S','MODEL X','MODEL Y']: add('tesla',x.lower().replace(' ','-'),x.title(),x)
for x in ['ATTO 3','DOLPHIN','HAN','SEAL','TANG','SEAL U']: add('byd',x.lower().replace(' ','-'),x.title(),x)
for x in ['OMODA 5','TIGGO 4','TIGGO 7','TIGGO 8','TIGGO']: add('chery',x.lower().replace(' ','-'),x.title(),x)
for x in ['ATECA','BORN','FORMENTOR','LEON','TAVASCAN']: add('cupra',x.lower(),x.title(),x)
for x in ['DS 3','DS 4','DS 7','DS 9']: add('ds',x.lower().replace(' ','-'),x,x)
for x in ['GIULIA','GIULIETTA','MITO','STELVIO','TONALE','159','156','147','BRERA']: add('alfa-romeo',x.lower(),x.title(),x)
for x in ['COOPER','COUNTRYMAN','CLUBMAN','PACEMAN','ONE']: add('mini',x.lower(),x.title(),x)

def norm(s): return ' '.join(unicodedata.normalize('NFKC',s).upper().split())
def boundary(h,n):
    start=0
    while True:
        i=h.find(n,start)
        if i<0:return None
        before=h[i-1] if i else ''; after=h[i+len(n)] if i+len(n)<len(h) else ''
        if (not before or not before.isalnum()) and (not after or not after.isalnum()): return i
        start=i+1
def slug(s):
    s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+','-',s).strip('-') or 'model'

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('snapshot'); ap.add_argument('out'); a=ap.parse_args()
    data=json.loads(Path(a.snapshot).read_text(encoding='utf-8')); recs=data['records']; out=Path(a.out); out.mkdir(parents=True,exist_ok=True)
    raw2brand={raw:k for k,(_,raws) in BRANDS.items() for raw in raws}
    models=defaultdict(dict); provisional=[]; collisions=[]; status=Counter()
    for r in recs:
        b=raw2brand.get(r['brandRaw'])
        if not b: status['unknown-brand']+=1; continue
        h=norm(r['typeRaw']); cand=[]
        for (bb,sk),(_,aliases) in S.items():
            if bb!=b: continue
            for alias in aliases:
                n=norm(alias); pos=boundary(h,n)
                if pos is not None:cand.append((len(n),sk,n,pos))
        if not cand: status['no-series']+=1; continue
        longest=max(x[0] for x in cand); top=[x for x in cand if x[0]==longest]
        if len({x[1] for x in top})!=1: status['ambiguous-series']+=1; continue
        _,sk,alias,pos=sorted(top,key=lambda x:x[3])[0]
        label=norm(h[:pos]+' '+h[pos+len(alias):])
        if not label: status['no-series']+=1; continue
        status['exact-series']+=1; key=f'{b}:{sk}:{slug(label)}'; previous=models[(b,sk)].get(key)
        if previous and norm(previous)!=norm(label): collisions.append(key); continue
        models[(b,sk)][key]=label; provisional.append((r['sourceKey'],key))
    bad=set(collisions); mappings=sorted(set((s,k) for s,k in provisional if k not in bad))
    brand_alias={'version':'2026-09-08.1','aliases':[{'raw':raw,'brandKey':k} for k,(name,raws) in sorted(BRANDS.items(),key=lambda x:x[1][0]) for raw in raws]}
    series_alias={'version':'2026-09-08.1','entries':[{'brandKey':b,'seriesKey':f'{b}:{sk}','aliases':aliases} for (b,sk),(name,aliases) in sorted(S.items(),key=lambda x:(BRANDS[x[0][0]][0],x[1][0]))]}
    brands=[]
    for b,(bname,_) in sorted(BRANDS.items(),key=lambda x:x[1][0]):
        ser=[]
        for (bb,sk),(sname,_) in sorted(S.items(),key=lambda x:x[1][0]):
            if bb!=b or not models.get((b,sk)): continue
            ser.append({'key':f'{b}:{sk}','name':sname,'models':[{'key':k,'name':v} for k,v in sorted(models[(b,sk)].items(),key=lambda x:x[1])]})
        if ser: brands.append({'key':b,'name':bname,'series':ser})
    catalog={'version':'2026-09-08.1','brands':brands}
    mapfile={'version':'2026-09-08.1','mappings':[{'sourceKey':s,'vehicleModelKey':k,'method':'exact-rule'} for s,k in mappings]}
    manifest={'version':'2026-09-08.1','sources':[{'name':'Türkiye Sigorta Birliği Kasko Değer Listesi','sourceUrl':'https://www.tsb.org.tr/tr/kasko-arsiv-listesi','sourcePeriod':data['provider']['version'],'accessedDate':'2026-09-08','licenseOrTerms':'No open redistribution license observed; raw export and operational normalized snapshot are not committed; kasko price values are discarded.','role':'turkey-coverage'},{'name':'global-car-models','sourceUrl':'https://github.com/serhatkildaci/global-car-models','pinnedCommit':'44da5c9e5e0f3162d65579033f7a641473308b11','accessedDate':'2026-09-08','licenseOrTerms':'MIT','role':'nameplate-bootstrap'}],'curation':{'method':'Explicit brand aliases and deterministic longest token-boundary series aliases; ambiguous/colliding candidates remain unmapped.','tsbSnapshotRecords':len(recs),'mappedSourceCodes':len(mappings),'canonicalBrands':len(brands),'canonicalSeries':sum(len(b['series']) for b in brands),'canonicalModels':sum(len(s['models']) for b in brands for s in b['series']),'slugCollisionsExcluded':len(bad),'ambiguousSeriesExcluded':status['ambiguous-series']}}
    for name,obj in [('brand-aliases.json',brand_alias),('series-aliases.json',series_alias),('catalog.json',catalog),('tsb-mappings.json',mapfile),('source-manifest.json',manifest)]: (out/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':status,'manifest':manifest['curation']},default=dict,ensure_ascii=False))
if __name__=='__main__': main()
