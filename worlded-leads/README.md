# WorldEd Leads

Rotina semanal para gerar leads de escolas particulares da Grande Sao Paulo com potencial de compra de Dual Diploma / High School americano da WorldEd.

O foco comercial nao e uma lista generica de escolas. A rotina separa:

- escolas bilingues ou com proposta internacional, mas sem IB/AP/Dual Diploma/High School detectado;
- escolas independentes ou redes pequenas/medias com decisao local ou semi-local;
- escolas reputadas com Fundamental II e/ou Ensino Medio relevante;
- escolas que ja possuem diploma internacional forte, marcadas como benchmark/exclusao;
- franquias e redes centralizadas, marcadas para abordagem corporativa.

## Como rodar localmente

```bash
cd worlded-leads
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=src python -m worlded_leads.main collect --mode fixture
```

Para live:

```bash
PYTHONPATH=src python -m worlded_leads.main collect --mode live
```

## E-mail

O envio usa SMTP por variaveis de ambiente:

- `SMTP_SERVER`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `LEADS_EMAIL_TO`

Depois de uma coleta:

```bash
PYTHONPATH=src python -m worlded_leads.main send-email --run-dir data/outputs/<run_id>
```

## INEP / BigQuery

A coleta ampla de escolas privadas usa Base dos Dados/BigQuery quando estes secrets estiverem configurados:

- `BIGQUERY_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`

Sem esses secrets, a rotina roda com uma base seed/fixture e marca o status como alerta. Ela nao inventa numeros de matricula.

## Saidas geradas

- `worlded-leads.csv`
- `worlded-leads.html`
- `worlded-leads.json`
- `new-leads.csv`
- `long-list.csv`
- `summary.md`
- `operational-status.json`

O workflow semanal envia os anexos por e-mail e salva os artefatos da execucao.
