# Consultoria Lead Hunter

Rastreador semanal de leads para consultoria. Ele busca sinais recentes de empresas vivas com dor de crescimento, processo, receita, atendimento, caixa, sucessao ou gestao.

O sistema procura gatilhos de contexto, nao termos genericos como "reduzir custos":

- expansao rapida, aporte ou abertura de unidade;
- vaga de controller, FP&A, gerente de operacoes, melhoria continua, S&OP ou processos;
- implantacao de ERP, CRM, BI, automacao ou digitalizacao;
- atrasos, reclamacoes, Procon, gargalos de atendimento ou logistica;
- queda de matriculas, inadimplencia escolar, captacao de alunos;
- sucessao, venda, busca de socio ou investidor;
- recuperacao judicial e demissoes apenas como distress, com prioridade menor.

O workflow semanal usa memoria em cache para mandar no e-mail apenas os leads novos da semana e manter uma long list acumulada.

No modo live, o sistema roda uma varredura ampla em Google News RSS e GDELT, com varias combinacoes de gatilhos e cidades. O teste fixture continua pequeno de proposito, para validar rejeicao de oferta de consultoria, deduplicacao e memoria semanal.

Para escolas, o sistema tenta enriquecer o lead com:

- estimativa de mensalidade a partir de paginas publicas de Quero Bolsa, Melhor Escola e Educa Mais Brasil;
- faixa de mensalidade de baixa confianca quando a escola especifica nao aparece;
- tendencia de matriculas 2020-2025 via BigQuery/INEP quando houver `id_escola` e credenciais configuradas.

Secrets opcionais para INEP via BigQuery:

- `BIGQUERY_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`
