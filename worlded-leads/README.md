# WorldEd Leads

Rotina sob demanda para gerar leads de escolas particulares da Grande Sao Paulo com potencial de compra de Dual Diploma / High School americano da WorldEd.

O foco comercial nao e uma lista generica de escolas. A rotina separa:

- escolas bilingues ou com proposta internacional, mas sem IB/AP/Dual Diploma/High School detectado;
- escolas independentes ou redes pequenas/medias com decisao local ou semi-local;
- escolas reputadas com Fundamental II e/ou Ensino Medio relevante;
- escolas que ja possuem diploma internacional forte, marcadas como benchmark/exclusao;
- franquias e redes centralizadas, marcadas para abordagem corporativa.

## Fonte principal: ZIPs oficiais do Inep

O padrao do MVP usa os ZIPs oficiais do Censo Escolar/Inep. Isso cobre 2025 mesmo quando BigQuery/Base dos Dados ainda nao tiver a tabela do ano.

Baixe os microdados oficiais do Censo Escolar no portal de microdados do Inep e coloque os arquivos em:

```text
worlded-leads/data/raw/
```

Nomes esperados:

```text
microdados_censo_escolar_2020.zip
microdados_censo_escolar_2021.zip
microdados_censo_escolar_2022.zip
microdados_censo_escolar_2023.zip
microdados_censo_escolar_2024.zip
microdados_censo_escolar_2025.zip
```

A rotina tambem aceita nomes equivalentes que contenham o ano, como arquivos com ` (1)` no nome.

Se voce quiser rodar no GitHub Actions, esses ZIPs precisam estar no proprio repositorio em `worlded-leads/data/raw/`. Eles nao sao gerados pela rotina; sao a fonte bruta oficial.

## Como preparar localmente

```bash
cd worlded-leads
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Se os ZIPs estiverem no seu Downloads, copie ou mova para `data/raw/` e, se quiser, padronize os nomes:

```bash
mkdir -p data/raw
cp "/Users/eduardominari/Downloads/microdados_censo_escolar_2020.zip" data/raw/microdados_censo_escolar_2020.zip
cp "/Users/eduardominari/Downloads/microdados_censo_escolar_2021.zip" data/raw/microdados_censo_escolar_2021.zip
cp "/Users/eduardominari/Downloads/microdados_censo_escolar_2022 (1).zip" data/raw/microdados_censo_escolar_2022.zip
cp "/Users/eduardominari/Downloads/microdados_censo_escolar_2023.zip" data/raw/microdados_censo_escolar_2023.zip
cp "/Users/eduardominari/Downloads/microdados_censo_escolar_2024 (1).zip" data/raw/microdados_censo_escolar_2024.zip
cp "/Users/eduardominari/Downloads/microdados_censo_escolar_2025_ (1).zip" data/raw/microdados_censo_escolar_2025.zip
```

## Comandos

Gerar a base consolidada do Inep 2020-2025:

```bash
PYTHONPATH=src python -m worlded_leads.main build-base --offline
```

Por padrao, a base fica limitada a Grande Sao Paulo. Para mudar o territorio:

```bash
# Grande Sao Paulo, padrao
PYTHONPATH=src python -m worlded_leads.main build-base --offline --scope grande-sp

# Estado inteiro de Sao Paulo
PYTHONPATH=src python -m worlded_leads.main build-base --offline --scope state --uf SP

# Somente municipio de Sao Paulo
PYTHONPATH=src python -m worlded_leads.main build-base --offline --scope municipality --municipality "Sao Paulo"

# Lista de municipios
PYTHONPATH=src python -m worlded_leads.main build-base --offline --scope municipality --municipality "Sao Paulo,Barueri,Osasco"

# Por codigo IBGE do municipio
PYTHONPATH=src python -m worlded_leads.main build-base --offline --scope municipality --municipality-code "3550308,3505708"

# Brasil inteiro, se realmente quiser
PYTHONPATH=src python -m worlded_leads.main build-base --offline --scope all
```

Enriquecer publicamente e classificar:

```bash
PYTHONPATH=src python -m worlded_leads.main enrich --mode live
```

O enriquecimento usa cache e, por padrao, prioriza as escolas com maior potencial: maior numero de alunos, mais Fundamental II/Ensino Medio, municipios premium e bairros nobres quando o Inep trouxer bairro/endereco.

Para enriquecer em lotes:

```bash
# Primeiras 300 escolas pendentes, ja ordenadas por prioridade comercial
PYTHONPATH=src python -m worlded_leads.main enrich --mode live --enrich-limit 300

# Proximo lote: basta rodar de novo; a rotina usa cache e pega as proximas pendentes
PYTHONPATH=src python -m worlded_leads.main enrich --mode live --enrich-limit 300

# Todas as pendentes de uma vez
PYTHONPATH=src python -m worlded_leads.main enrich --mode live --enrich-limit 0
```

No GitHub Actions, o cache de enriquecimento fica em `.lead-state/public-enrichment-cache.json` e e preservado entre execucoes pelo cache do workflow.

Se quiser ignorar a fila inteligente:

```bash
PYTHONPATH=src python -m worlded_leads.main enrich --mode live --enrich-order base
```

Gerar CSV, JSON, HTML e resumo:

```bash
PYTHONPATH=src python -m worlded_leads.main report --mode live
```

Enviar o ultimo relatorio por e-mail:

```bash
PYTHONPATH=src python -m worlded_leads.main send-email --run-dir data/outputs/<run_id>
```

Rodar tudo em sequencia:

```bash
PYTHONPATH=src python -m worlded_leads.main run-all --offline --mode live
```

O `run-all` tambem aceita os mesmos filtros territoriais:

```bash
PYTHONPATH=src python -m worlded_leads.main run-all --offline --mode live --scope municipality --municipality "Sao Paulo"
```

Tambem e possivel apontar diretamente para outra pasta de ZIPs:

```bash
PYTHONPATH=src python -m worlded_leads.main build-base --offline --raw-dir "/Users/eduardominari/Downloads"
```

## Saidas geradas

Base consolidada:

```text
data/processed/censo_escolar_2020_2025.parquet
```

Relatorios:

```text
data/outputs/<run_id>/worlded_leads.csv
data/outputs/<run_id>/worlded_leads.json
data/outputs/<run_id>/worlded_leads.html
data/outputs/<run_id>/summary.txt
data/outputs/<run_id>/summary.md
data/outputs/<run_id>/new-leads.csv
data/outputs/<run_id>/long-list.csv
data/outputs/<run_id>/operational-status.json
```

Esses arquivos sao artefatos de execucao e nao devem ser commitados.

## E-mail

O envio usa SMTP por variaveis de ambiente:

- `SMTP_SERVER`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `LEADS_EMAIL_TO`

Exemplo:

```bash
export SMTP_SERVER=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USERNAME="seu-email"
export SMTP_PASSWORD="senha-ou-app-password"
export SMTP_FROM="WorldEd Leads <seu-email>"
export LEADS_EMAIL_TO="eduardo.minari@gmail.com"
PYTHONPATH=src python -m worlded_leads.main run-all --offline --mode live
```

## BigQuery opcional

BigQuery nao e obrigatorio. O padrao e offline.

Para usar BigQuery como alternativa, configure:

- `USE_BIGQUERY=true`
- `BIGQUERY_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`

Sem `USE_BIGQUERY=true`, a rotina usa os ZIPs locais.

## GitHub Actions

O workflow da WorldEd e sob demanda. Para rodar:

1. Entre no repositorio no GitHub.
2. Abra `Actions`.
3. Escolha `WorldEd Dual Diploma leads`.
4. Clique em `Run workflow`.
5. Use `source = inep-zips` para processar os ZIPs de `worlded-leads/data/raw/`.
6. Escolha o territorio em `scope`: `grande-sp`, `state`, `municipality` ou `all`.
7. Use `enrich_limit = 300` para lote seguro ou `0` para tentar todas as pendentes na mesma execucao.

Nao ha agendamento semanal, porque o Censo Escolar nao muda toda semana. Rode quando quiser atualizar a base ou depois de subir novos ZIPs.

Atencao: o GitHub Actions nao enxerga automaticamente os ZIPs que estao no seu computador. Para o run no GitHub funcionar com `source = inep-zips`, os ZIPs precisam estar commitados/subidos no repositorio. Se quiser usar BigQuery como alternativa, escolha `source = bigquery` e configure `USE_BIGQUERY=true` e os secrets de credenciais.

## Camadas comerciais

- Camada A: prioridade alta. Escola particular, boa/reputada, com Fundamental II e/ou Ensino Medio relevante, programa bilingue/internacional claro, sem IB/AP/Dual Diploma/High School detectado e decisao local ou semi-local.
- Camada B: boa oportunidade, mas precisa qualificar decisor, programa bilingue, etapas atendidas ou ausencia de diploma internacional.
- Camada C: excluir da abordagem principal. Ja tem IB/AP/Dual Diploma/High School ou equivalente.
- Camada D: abordagem corporativa/rede. Franquia, rede grande ou grupo com decisao centralizada.
- Camada E: baixo fit. Sem Fundamental II/Medio relevante, sem dados suficientes ou sem perfil para compra.

## Dados ausentes

A rotina nao inventa dado. Campo ausente no Inep ou na web fica como `null`, `nao encontrado` ou `precisa qualificar`, e o alerta aparece nos metadados/relatorio.
