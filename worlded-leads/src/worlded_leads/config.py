from __future__ import annotations

YEARS = [2020, 2021, 2022, 2023, 2024, 2025]

TARGET_MUNICIPALITIES = {
    "3550308": "Sao Paulo",
    "3505708": "Barueri",
    "3547304": "Santana de Parnaiba",
    "3534401": "Osasco",
    "3518800": "Guarulhos",
    "3547809": "Santo Andre",
    "3548708": "Sao Bernardo do Campo",
    "3548807": "Sao Caetano do Sul",
    "3513801": "Diadema",
    "3513009": "Cotia",
    "3510609": "Carapicuiba",
    "3552809": "Taboao da Serra",
    "3515004": "Embu das Artes",
    "3522505": "Itapevi",
    "3525003": "Jandira",
    "3530607": "Mogi das Cruzes",
    "3552502": "Suzano",
    "3523107": "Itaquaquecetuba",
    "3509007": "Caieiras",
    "3516408": "Franco da Rocha",
    "3516309": "Francisco Morato",
    "3528502": "Mairipora",
    "3543303": "Ribeirao Pires",
    "3544103": "Rio Grande da Serra",
    "3556453": "Vargem Grande Paulista",
}

BILINGUAL_TERMS = [
    "programa bilingue",
    "programa bilíngue",
    "ensino bilingue",
    "ensino bilíngue",
    "bilingual program",
    "bilinguismo",
    "bilíngue",
    "international program",
    "internacionalizacao",
    "internacionalização",
    "global education",
    "contraturno bilingue",
    "contraturno bilíngue",
]

IB_TERMS = [
    "international baccalaureate",
    "ib world school",
    "programa ib",
    "diploma programme",
    "primary years programme",
    "middle years programme",
]

AP_TERMS = [
    "advanced placement",
    "ap courses",
    "ap program",
    "college board ap",
]

DUAL_DIPLOMA_TERMS = [
    "dual diploma",
    "duplo diploma",
    "high school americano",
    "american high school",
    "mizzou academy",
    "academica",
    "rosedale",
    "griggs",
    "american school international",
    "asi high school",
    "diploma internacional",
]

CENTRALIZED_NETWORK_PATTERNS = [
    "maple bear",
    "red house",
    "start anglo",
    "start bilíngue",
    "start bilingue",
    "ways education",
    "ways bilingual school",
]

GROUP_PATTERNS = [
    "grupo sebes",
    "sebes",
    "grupo etapa",
    "grupo objetivo",
    "grupo positivo",
    "grupo salta",
    "cogna",
    "grupo eleva",
    "rede decisa",
    "rede salesiana",
]

REPUTATION_HINTS = [
    "tradicional",
    "aprovacao",
    "aprovação",
    "enem",
    "olimpiada",
    "olimpíada",
    "alto padrao",
    "alto padrão",
    "excelencia",
    "excelência",
    "preparacao para universidades",
    "preparação para universidades",
]

PUBLIC_SEARCH_LIMIT = 5
PUBLIC_FETCH_TIMEOUT_SECONDS = 12


def fixture_school_records() -> list[dict]:
    return [
        {
            "inep_code": "35000001",
            "school": "Colegio Horizonte Bilingue",
            "municipality": "Sao Paulo",
            "region": "Grande Sao Paulo",
            "site": "https://example.com/horizonte",
            "phone": "(11) 3000-0001",
            "email": "contato@horizonte.example",
            "source_kind": "fixture",
            "enrollments": {
                "2020": {"total": 820, "fundamental_ii": 210, "ensino_medio": 160},
                "2021": {"total": 840, "fundamental_ii": 218, "ensino_medio": 166},
                "2022": {"total": 870, "fundamental_ii": 225, "ensino_medio": 172},
                "2023": {"total": 890, "fundamental_ii": 230, "ensino_medio": 180},
                "2024": {"total": 910, "fundamental_ii": 238, "ensino_medio": 188},
                "2025": {"total": None, "fundamental_ii": None, "ensino_medio": None},
            },
        },
        {
            "inep_code": "35000002",
            "school": "Colegio Magister",
            "municipality": "Sao Paulo",
            "region": "Grande Sao Paulo",
            "site": "https://example.com/magister",
            "phone": "",
            "email": "",
            "source_kind": "fixture",
            "enrollments": {
                "2020": {"total": 760, "fundamental_ii": 180, "ensino_medio": 140},
                "2021": {"total": 750, "fundamental_ii": 175, "ensino_medio": 142},
                "2022": {"total": 752, "fundamental_ii": 180, "ensino_medio": 146},
                "2023": {"total": 760, "fundamental_ii": 184, "ensino_medio": 148},
                "2024": {"total": 766, "fundamental_ii": 188, "ensino_medio": 150},
                "2025": {"total": None, "fundamental_ii": None, "ensino_medio": None},
            },
        },
        {
            "inep_code": "35000003",
            "school": "Maple Bear Alphaville",
            "municipality": "Barueri",
            "region": "Grande Sao Paulo",
            "site": "https://example.com/maple",
            "phone": "",
            "email": "",
            "source_kind": "fixture",
            "enrollments": {
                "2020": {"total": 520, "fundamental_ii": 95, "ensino_medio": 0},
                "2021": {"total": 540, "fundamental_ii": 100, "ensino_medio": 0},
                "2022": {"total": 560, "fundamental_ii": 108, "ensino_medio": 0},
                "2023": {"total": 570, "fundamental_ii": 112, "ensino_medio": 0},
                "2024": {"total": 590, "fundamental_ii": 118, "ensino_medio": 0},
                "2025": {"total": None, "fundamental_ii": None, "ensino_medio": None},
            },
        },
        {
            "inep_code": "35000004",
            "school": "Colegio Regional Sao Caetano",
            "municipality": "Sao Caetano do Sul",
            "region": "Grande Sao Paulo",
            "site": "https://example.com/regional",
            "phone": "",
            "email": "",
            "source_kind": "fixture",
            "enrollments": {
                "2020": {"total": 640, "fundamental_ii": 155, "ensino_medio": 120},
                "2021": {"total": 625, "fundamental_ii": 150, "ensino_medio": 118},
                "2022": {"total": 610, "fundamental_ii": 145, "ensino_medio": 112},
                "2023": {"total": 600, "fundamental_ii": 142, "ensino_medio": 108},
                "2024": {"total": 590, "fundamental_ii": 138, "ensino_medio": 104},
                "2025": {"total": None, "fundamental_ii": None, "ensino_medio": None},
            },
        },
        {
            "inep_code": "35000005",
            "school": "Escola Infantil Pequenos Passos",
            "municipality": "Osasco",
            "region": "Grande Sao Paulo",
            "site": "https://example.com/infantil",
            "phone": "",
            "email": "",
            "source_kind": "fixture",
            "enrollments": {
                "2020": {"total": 110, "fundamental_ii": 0, "ensino_medio": 0},
                "2021": {"total": 115, "fundamental_ii": 0, "ensino_medio": 0},
                "2022": {"total": 118, "fundamental_ii": 0, "ensino_medio": 0},
                "2023": {"total": 116, "fundamental_ii": 0, "ensino_medio": 0},
                "2024": {"total": 119, "fundamental_ii": 0, "ensino_medio": 0},
                "2025": {"total": None, "fundamental_ii": None, "ensino_medio": None},
            },
        },
    ]
