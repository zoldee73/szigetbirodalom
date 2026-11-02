# Szigetbirodalom V10 – állapot

A csomag **fejlesztői változat**, nem kész, éles Messenger-játék.

## Ellenőrizve
- Node.js szintaxis és a meglévő, valamint bővített automatikus alapszabály-tesztek.
- A kikötők két szomszédos parti csomópontot jelölnek.
- Klasszikus (3–4 fős) szoba csak három játékostól indul; a `classic2` két fővel is indul.

## Nem ellenőrzött / hiányzik
- A `duo` mód **nem** a hivatalos kétjátékos szabályok teljes implementációja.
- Teljes, végigjátszott szabályteszt és két valódi telefonos teszt.
- Online közzététel, tartós játékmentés és valódi Messenger-meghívólink.

## Közzététel
HTTPS + WebSocket-képes Node.js szolgáltatás szükséges. A GitHub Pages önmagában nem futtatja a szervert. A játékosoknak nincs szükségük telepítésre, de a közzétételhez egy hosztoló fiók és telepítés szükséges. Ne adj meg bankkártyaadatot csak azért, hogy kipróbáljuk.
