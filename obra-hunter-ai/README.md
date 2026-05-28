# Obra Hunter AI

Radar semanal para encontrar oportunidades privadas de obra com tese comercial para vidro, esquadrias, fachadas, pintura, coberturas, obra civil, hidraulica e eletrica.

Regra central: licitacao publica, pregao, edital, PNCP, registro de precos e manutencao urbana generica nao entram no ranking comercial.

## Como rodar no GitHub

Entre no repositorio e abra:

`Actions` -> `Obra Hunter AI weekly leads` -> `Run workflow`

Use `fixture` para testar o envio e `live` para tentar uma coleta real.

O workflow semanal roda toda segunda-feira as 07:00 de Sao Paulo.

## E-mail

Destino fixo:

`eduardo.minari@gmail.com`

Secrets necessarios em `Settings` -> `Secrets and variables` -> `Actions`:

- `SMTP_SERVER`, exemplo `smtp.gmail.com`
- `SMTP_PORT`, normalmente `587`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`, de preferencia senha de app
- `SMTP_FROM`, exemplo `Obra Hunter AI <seu-email@gmail.com>`

Sem esses secrets, o workflow gera os arquivos mas nao envia e-mail.

## Saidas

Cada execucao grava em `obra-hunter-ai/data/runs/<run_id>/`:

- `summary.md`
- `leads.csv`
- `ranked-leads.json`
- `rejected-signals.json`
- `operational-status.json`
- `email-body.txt`
- `email-subject.txt`
