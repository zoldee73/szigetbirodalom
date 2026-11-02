# Közzététel és Messenger-meghívás

A program Node.js + WebSocket szervert igényel. **GitHub Pages önmagában nem elegendő.**

1. Hozz létre privát vagy nyilvános GitHub repót, és töltsd fel a csomag fájljait.
2. Válassz egy HTTPS és WebSocket támogatású Node.js hosztot, amelynek van az adott időpontban ténylegesen elérhető ingyenes csomagja.
3. Kapcsold hozzá a repót; build: `npm install`; start: `npm start`; port: a szolgáltató `PORT` környezeti változója.
4. Nyisd meg a kapott HTTPS címet iPhone Safariban, hozz létre szobát, és a **Meghívás Messengeren** gombbal oszd meg.
5. Samsung Chrome böngészőből nyissátok meg a linket.

**Korlátok:** a szobák csak memóriában élnek, szerverújraindítás után elvesznek. Az ingyenes szolgáltatók alvó állapotba kerülhetnek, korlátozhatják a WebSocketet, vagy idővel változtathatják a díjakat. A kétjátékos speciális szabályok még nem teljesek. A tényleges távoli telefonos teszt nincs elvégezve.
