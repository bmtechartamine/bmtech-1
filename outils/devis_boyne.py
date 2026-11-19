"""Devis bornes de recharge – M. Fernand Boyne (réf. Saint-Georges), 3 offres."""
from devis_pdf import build

D = "/home/user/bmtech-1/devis/"
DATE = "19/11/2026"
CLIENT = "M. Fernand Boyne<br/>Saint-Georges<br/>fernandboyne@yahoo.fr"
NOTES = [
    "* Liaison prévue jusqu'à 10 m entre le coffret électrique et la borne ; au-delà, supplément de 15 € HTVA par mètre.",
    "* Contrôle de conformité RGIE par un organisme agréé : supplément de 300 € HTVA.",
    "* Les travaux de terrassement, carottage de murs épais ou réfection de finitions ne sont pas compris.",
]
COMMUNS = [
    ("Câble d'alimentation XVB 3G6 mm² (jusqu'à 10 m), tubage, attaches et raccords compris", 1, 200.00),
    ("Protections au tableau : disjoncteur dédié 40 A, différentiel 30 mA type A, raccordement", 1, 250.00),
    ("Main-d'œuvre : pose de la borne, tirage du câble, raccordement, essais et mise en service", 1, 350.00),
]
OFFRES = [
    ("DEV-2026-0157", "EVSE",
     "Fourniture et installation d'une borne de recharge EVSE 7,4 kW monophasée – Offre 1",
     ("Borne de recharge EVSE 7,4 kW monophasée (32 A), connecteur Type 2, "
      "compatible voiture électrique et hybride rechargeable", 650.00)),
    ("DEV-2026-0158", "Wallbox",
     "Fourniture et installation d'une borne de recharge Wallbox Pulsar Plus 7,4 kW – Offre 2",
     ("Borne de recharge Wallbox Pulsar Plus 7,4 kW monophasée (32 A), câble Type 2 attaché, "
      "connectée Wi-Fi / Bluetooth, gestion et suivi via application", 850.00)),
    ("DEV-2026-0159", "Alfen",
     "Fourniture et installation d'une borne de recharge Alfen Eve Single Pro-line 7,4 kW – Offre 3",
     ("Borne de recharge Alfen Eve Single Pro-line 7,4 kW monophasée (32 A), compteur certifié MID, "
      "lecteur de badge RFID, OCPP (compatible remboursement voiture de société)", 1150.00)),
]

for number, marque, title, (borne, prix) in OFFRES:
    build(f"{D}{number}_Boyne_borne_{marque}_7kW.pdf", number, DATE, title,
          [(borne, 1, prix)] + COMMUNS,
          client=CLIENT, ref_label="Réf. client :", ref="Saint-Georges", notes=NOTES)
