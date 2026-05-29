# Regras Comerciais WorldEd

Objetivo: priorizar escolas particulares da Grande Sao Paulo para venda de Dual Diploma / High School americano.

## Camadas

- Camada A: escola particular com Fundamental II e/ou Ensino Medio relevante, programa bilingue/internacional claro, sem IB/AP/Dual Diploma/High School detectado e decisao local ou semi-local.
- Camada B: boa oportunidade, mas ainda precisa qualificar decisor, programa bilingue, etapas atendidas ou ausencia de diploma internacional.
- Camada C: escola com IB/AP/Dual Diploma/High School ou diploma internacional equivalente detectado. Nao entra na prospeccao principal; fica como benchmark.
- Camada D: franquia, rede grande ou grupo com decisao centralizada. Abordagem deve ser corporativa.
- Camada E: baixo fit, sem Fundamental II/Medio relevante, sem dados suficientes ou sem perfil para compra.

## Score

- 25 pontos: Fundamental II e/ou Ensino Medio relevante.
- 20 pontos: matricula crescendo ou estavel.
- 20 pontos: posicionamento bilingue/internacional claro.
- 15 pontos: ausencia de IB/AP/Dual Diploma/High School.
- 15 pontos: decisao local ou semi-local provavel.
- 5 pontos: reputacao ou aspiracao de marca.

## Principios

- Nao inventar matriculas, decisores, telefones ou e-mails.
- Registrar fonte de cada evidencia comercial.
- Separar fato de inferencia no motivo da classificacao.
- Classificar redes centralizadas para abordagem corporativa, nao unidade local.
- Usar codigo INEP como chave principal sempre que disponivel.

## Fonte Inep

- O padrao operacional usa ZIPs oficiais do Censo Escolar/Inep em `data/raw/`, inclusive para cobrir 2025.
- BigQuery/Base dos Dados e apenas fonte alternativa quando `USE_BIGQUERY=true`.
- O filtro territorial deve ser explicito e auditavel: Grande SP por padrao, estado, municipio/lista de municipios ou Brasil inteiro quando solicitado.
- Quando 2025 ou qualquer outro ano nao estiver disponivel, preencher como dado ausente e registrar alerta; nunca estimar matricula sem fonte.
- O enriquecimento publico deve seguir fila inteligente: maiores escolas primeiro, mais alunos em Fundamental II/Medio, municipios premium e bairros nobres quando o Inep trouxer bairro/endereco.
- O cache de enriquecimento deve ser preservado para permitir lotes sucessivos sem refazer buscas ja concluidas.
- A tendencia usa a variacao total entre 2020 e 2025:
  - crescendo: acima de +5%.
  - estavel: entre -5% e +5%.
  - caindo: abaixo de -5%.
  - sem dados: sem 2020 ou sem 2025.
