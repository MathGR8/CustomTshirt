# App do tablet (totem de personalização)

Versão do configurador feita para ficar num **tablet na loja**: o próprio cliente
escolhe a camiseta, a arte (do catálogo da loja), ajusta com o dedo, diz os
tamanhos e recebe o **número do pedido** para mostrar ao atendente.

É independente do configurador do site (`camisetas_refatorado_V2`), que não foi alterado.

## Como o cliente usa

1. **Modelo**: Masculina, Feminina ou Infantil/Juvenil. O botão **Tabela de medidas**
   mostra largura, altura, manga/cintura de cada tamanho com o desenho de como medir.
2. **Estampa**, dois caminhos:
   - **Camiseta pronta**: as artes da loja (galeria por temas, com busca). Tamanho e posição
     da arte já vêm definidos pela loja; o cliente só escolhe a **cor** (entre as liberadas)
     e vai para os tamanhos. Pode ter arte na frente e nas costas. O cliente também pode
     **adicionar textos** (nome, frase, número) na pronta, pelo botão "Escolher e adicionar um
     texto" ou em Tamanhos/Revisar: a estampa da loja continua fixa, só o texto se mexe.
     O botão **Estampa nas costas / na frente** passa a estampa da loja para o outro lado.
   - **Criar a minha**: o cliente escolhe a malha e a cor e coloca:
     - **Imagem**: enviar a própria arte (PDF, SVG, AI, PNG, JPG — do tablet, pendrive,
       Google Drive…) ou **buscar na internet** ([Openverse](https://openverse.org), só imagens
       com licença que permite uso comercial e modificação; filtro "Só vetores").
     - **Texto**: 13 fontes, 12 cores, contorno opcional e tamanhos rápidos (8, 15, 24 e 32 cm).
       Depois dá para editar (lápis) e ajustar o tamanho como uma arte.
     Arrastar com um dedo, mudar o tamanho com dois dedos ou com os botões + e −.
     Cada imagem/texto tem o botão **Lado** (Frente / Costas) para mudar de lado. Se uma arte
     ficar por cima de outra, o app pergunta se é isso mesmo (deixar, mudar de lado ou desfazer).
     A arte nunca passa da área máxima (38 × 42 cm na masculina, 30 × 35 na feminina e
     juvenil; no infantil a arte é reduzida automaticamente para caber em 20 × 24).
     Nas imagens o app mostra a **qualidade de impressão** (vetor = ótima; imagem: boa a partir
     de 220 dpi, aceitável de 150 a 220, baixa abaixo de 150) e pede confirmação antes de usar
     uma imagem de qualidade baixa.
   - Também há "Quero camiseta lisa".
3. **Tamanhos**: quantidades com + e −; cada tamanho mostra as medidas da peça (toque para
   abrir a tabela com o tamanho destacado).
4. **Revisar**: o botão **Editar** abre um menu da camiseta (sem recomeçar): ver a camiseta com
   a estampa, mudar a cor, adicionar ou mudar textos, trocar a arte (pronta) ou mudar a estampa
   (criada), mudar tamanhos e quantidades. Depois volta direto para a revisão.
   Dá para adicionar outras camisetas no mesmo pedido.
5. **Seus dados** e **Pronto**: o número do pedido aparece em destaque.

Cada tela tem o botão **Ajuda** com dicas curtas. Na tela inicial há o
**Ver como funciona**, e a primeira vez em "Personalizar" mostra uma dica animada.
Se o cliente sair no meio, depois de alguns minutos o app pergunta
**"Ainda está aí?"** e volta ao início.

## Área do administrador

Toque **5 vezes** no nome da loja (canto superior esquerdo) ou segure o dedo nele
por 2 segundos. Senha inicial: **1234** (troque em Configurações).

- **Artes**: importar arquivos, uma pasta ou um **.ZIP** com pastas. O nome da
  pasta vira o tema (ex.: `Rock/banda.pdf` → tema Rock). Também dá para renomear,
  ocultar, apagar e trocar o tema.
- **Selecionar várias**: botão no catálogo (ou segure o dedo numa arte). Marque artes soltas ou um
  tema inteiro e aplique de uma vez: configurar camiseta pronta (cada campo pode ficar "não mudar"),
  mover para outro tema, ocultar, mostrar ou apagar.
- **Camiseta pronta** (toque numa arte): lado (frente/costas), **largura da arte** (definida
  para a masculina; nos outros modelos fica proporcional), **posição** (centro, peito, no alto),
  **cores liberadas** e uma **arte para as costas** (ela some da galeria e vai junto). Há uma
  prévia na camiseta e a opção de aplicar o mesmo tamanho/posição/cores a todo o tema.
  Sem configurar: frente, 28 cm, no alto, todas as cores.
- **Exportar cópia / Importar cópia**: leva o catálogo pronto para outro tablet.
- **Pedidos**: lista com o PDF de cada pedido (imagens da frente e costas,
  tamanhos, nome do arquivo de cada arte e medidas em cm). Pedidos com arte do cliente ou
  da internet mostram a qualidade, têm o botão **Artes do cliente** (baixa os arquivos
  originais e o crédito/licença) e um alerta quando alguma arte está com qualidade baixa.
  Os **textos** aparecem no PDF com o texto, a fonte e as cores, e vão no mesmo .zip como PNG
  transparente.
- **Preços**: preço de uma peça para cada modelo e malha, acréscimo por tamanho (ex.: X1 a X8
  mais caros), acréscimo para estampa na frente e nas costas e **acréscimo por texto** (por peça,
  vale também nas camisetas prontas). A chave **Mostrar preços para o
  cliente** esconde todos os preços do app (os pedidos continuam com o valor no administrador).
  Camiseta pronta pode ter **preço próprio** (toque na arte, na aba Artes). Com os preços ligados
  o cliente vê "a partir de" em cada modelo, o preço de cada tamanho e o total no fim.
- **Ver pedido**: abre o pedido em tela cheia, com as camisetas grandes (frente e costas), a
  tabela de tamanhos e valores e cada arte/texto separado. Tocar numa imagem abre o visualizador:
  toque para ampliar, arraste para mover, setas para passar entre as camisetas e as artes.
- **Configurações**: liga/desliga "Enviar minha arte" e "Buscar na internet".
- **Configurações**: nome da loja, frase inicial, senha e tempo de inatividade.

### Formatos das artes

| Formato | Como fica |
|---|---|
| **PDF** (recomendado) | Cada página vira uma arte, recortada em volta do desenho, com fundo transparente. |
| **CorelDRAW (.cdr)** | O navegador não abre arquivos do Corel. O app usa a **imagem de prévia** que o Corel grava dentro do arquivo (resolução menor, com o selo "baixa resolução"). Para melhor qualidade, converta em PDF (veja abaixo). |
| PNG, JPG, SVG | Usados direto (o fundo branco de JPG pode ser removido na importação). |
| .ZIP | Uma pasta compactada com subpastas por tema. |

As artes ficam guardadas **no próprio tablet** (não vão para a internet).

No PDF o app também lê o **tamanho real do desenho** (em cm). Esse tamanho vira a largura padrão da
camiseta pronta (até 38 cm), e aparece na edição da arte com o botão "usar este tamanho".

### PDF de catálogo (código em cima de cada arte)

Para cadastrar muitas estampas de uma vez: um PDF (ex.: exportado do CorelDRAW) com uma ou mais
artes por página, cada uma com um **selo branco com o código em cima** (ex.: `COD: ROCK-1`) e a
página no **fundo da cor da camiseta**. Com a opção **PDF de catálogo** marcada (vem marcada):

- cada arte é separada pelo seu selo (várias por página), sem o selo e sem as linhas de corte;
- o **código vira o nome** da arte (lido por OCR; precisa de internet na importação). Se algum
  código não der para ler, ele é deduzido pela sequência e aparece nos avisos para conferir;
- o **fundo vira a cor da camiseta**: a arte fica como **camiseta pronta só nessa cor** (ex.:
  fundo preto → Preto). Dá para mudar as cores depois em cada arte ou em **Selecionar várias →
  Camiseta pronta**.

Em **Catálogo**, o botão **Apagar todas** apaga todas as artes do tablet (pede confirmação duas
vezes; os pedidos já feitos não são afetados).

### Converter .cdr em PDF sem o CorelDRAW

O arquivo `ferramentas/converter-cdr-para-pdf.bat` (também em Administrador → Ajuda) converte todos
os .cdr de uma pasta e das subpastas em PDF vetorial, usando o **LibreOffice** (grátis):

1. Instale o LibreOffice: <https://pt-br.libreoffice.org/baixe-ja/>.
2. Arraste a pasta das artes para cima do `converter-cdr-para-pdf.bat` (Windows).
   Cada PDF é salvo ao lado do .cdr, na mesma pasta (o tema continua o mesmo).
3. Importe a pasta (ou o .ZIP) de novo no tablet. Quando há `arte.cdr` e `arte.pdf`, o app usa só
   o PDF; se a versão .cdr já estava no tablet, o PDF a substitui mantendo nome, tema e configuração.

Os arquivos que o LibreOffice não conseguir abrir (algumas versões muito novas ou antigas do Corel)
ficam listados em `cdr-nao-convertidos.txt`, e para eles o app continua usando a prévia.
No Mac/Linux, o comando equivalente é
`soffice --headless --convert-to pdf --outdir <pasta> <arquivo>.cdr`.

## Novidades do uso no tablet

- **Tela sem rolagem**: o topo (etapas) e o rodapé (Voltar / Avançar) ficam sempre na tela; o
  teclado só passa por cima. A altura é medida pelo próprio app (funciona também em Chrome antigo).
- **Desistiu de fazer outra camiseta?** Na primeira etapa da camiseta nova, **Meu pedido** volta
  para o pedido com as camisetas já montadas.
- **Zoom na camiseta** ao personalizar: botões − / + (canto de cima), dois dedos fora da arte e
  arrastar o fundo para mover.
- **Estampa em qualquer lugar da camiseta** (até mangas), em escala real. O tracejado é a área
  **recomendada**: fora dela aparece um aviso com o botão **Ajustar**, mas o cliente pode manter.
  O pedido avisa a confecção quando a posição é fora da área padrão.
- **Galeria em tela cheia**: botão **Tela cheia** nas camisetas prontas — camiseta grande no
  centro, deslize para o lado (ou use as setas) para ver as outras estampas.
- **Arte própria desligada** (Configurações → "Cliente pode enviar a própria arte"): ao tocar em
  Imagem o cliente vê as opções **Escrever um texto**, **Escolher uma arte pronta** ou **Quero
  usar a minha arte** (mostra o WhatsApp do responsável com QR code e deixa o cliente pedir para
  ser chamado). Preencha **Responsável** e **WhatsApp do responsável** em Configurações. Quem
  deixar o contato aparece para a confecção como **Contato** (com aviso de novo contato, botão
  "Chamar no WhatsApp" e "Marcar como atendido").
- **Descanso de tela** (só na página inicial): depois de alguns minutos sem toque
  (Configurações; padrão 2, 0 = nunca) a tela escurece sem fechar nada; um toque volta. Durante a
  navegação continua valendo o aviso "Ainda está aí?" que volta ao início.
- **Preço mínimo por peça estampada** (aba Preços): ligue a opção e preencha o mínimo de cada
  modelo e malha (ex.: R$ 69,97). Toda peça com estampa que der menos sai pelo mínimo.
- **↔ Centralizar**: centraliza a estampa só na horizontal (mantém a altura).
- **Imagens protegidas**: segurar o dedo numa imagem não abre mais o menu de copiar/baixar/compartilhar.

## Categorias, subcategorias e ordem

- **Ver as artes em tela cheia** (Administrador → Artes → **Ver em tela cheia**, ou o ícone ⤢ ao
  lado de cada categoria): a arte na camiseta, como o cliente vê. Passe com as **setas**,
  **deslizando o dedo** para o lado ou com ← → no teclado. Dá para trocar a cor, **Editar** e
  **Ocultar/Mostrar** ali mesmo.
- No app do cliente, a janela da estampa (normal ou tela cheia) também passa **deslizando o dedo**.

- **Ordem das categorias** (Administrador → Artes → **Ordem das categorias**): use as setas ou
  **Primeira** para escolher qual aparece primeiro para o cliente (ex.: Rock primeiro). Em
  **Subcategorias** dá para ordenar também as bandas/jogos/filmes de cada categoria. As que
  não estão na lista (novas) entram depois, em ordem alfabética.
- **Importar por pastas** (.zip ou pasta, com **PDF e PNG misturados**):
  `Categoria/Subcategoria/arquivo` → por exemplo `Rock/Metallica/arte.png` vira categoria
  **Rock** e subcategoria **Metallica**. A pasta de fora que só embrulha tudo (ex.: "Artes")
  é ignorada.
- **Código pelo nome do arquivo**: `ROCK-151 - Metallica – Logo.png` vira o código
  **ROCK-151** e o nome **Metallica – Logo**.

## Aviso de pedido no computador do gestor

A cada pedido novo (e a cada cliente que deixar o contato) aparece um **alerta com som** no
computador do gestor (no canto da tela, no Windows) ou na barra de notificações do celular,
**mesmo com a página dos pedidos fechada**: basta o Chrome/Edge estar aberto (por exemplo, com o
WhatsApp Web). Clicando no alerta, abre o pedido. É **grátis**, usa a notificação do próprio
navegador (sem WhatsApp, sem serviço de terceiros e sem chip no tablet).

Para ativar (uma vez por aparelho):

1. No computador do gestor, abra os pedidos da confecção (o endereço do app + `#confeccao`) e
   entre com a senha da confecção, marcando **Lembrar neste aparelho**.
2. Clique em **🔔 Avisos → Ativar neste aparelho** e, quando o navegador perguntar, em **Permitir**.
   Chega um aviso de teste na hora.

Com a página dos pedidos aberta (mesmo em outra aba), o pedido novo também **toca um som** (repete
até alguém clicar no painel), **pisca o título da aba** e fica **destacado** na lista.

Se o alerta não aparecer: desligue o "Não perturbe" do Windows, deixe as notificações do
Chrome/Edge ligadas em Configurações do Windows → Sistema → Notificações e, no Chrome, deixe ligado
"Continuar executando apps em segundo plano". No tablet, em **Administrador → Configurações**, dá
para ver os aparelhos cadastrados e mandar um aviso de teste.

## Pedidos no computador da confecção

Os pedidos são feitos no tablet da loja e podem ser vistos em qualquer computador:

1. O envio já vem **ligado**: cada pedido novo feito no tablet vai sozinho para a confecção.
   A **senha inicial da confecção é `000000`**.
2. No computador: abra **o mesmo endereço do app** (`https://<endereço do app>/`), clique em
   **Acesso da equipe** (canto de baixo) e digite a senha da confecção. A mesma janela serve para
   as duas senhas: a do **administrador** abre o Administrador e a da **confecção** abre os pedidos.
   No computador a senha fica lembrada (abre direto nos pedidos); **Sair** volta para o app da loja.
   No tablet, a janela abre com 5 toques no nome da loja, e a senha da confecção vale só até
   fechar o app. O endereço antigo `/pedidos.html` continua funcionando.
   A senha que vale é sempre a que aparece no tablet em **Administrador → Configurações →
   Senha da confecção**. Depois de 10 tentativas erradas, o acesso fica bloqueado por 15 minutos.
3. Para trocar a senha (recomendado): no tablet, **Administrador → Configurações → Pedidos no
   computador da confecção**, preencha **Trocar a senha da confecção** (mínimo 6 caracteres) e
   toque em **Testar e salvar**. No computador, entre de novo com a nova senha.

O pedido é enviado na hora em que o cliente toca em **Enviar pedido**; a tela final mostra
"Enviado para a confecção" (ou o motivo, se não deu). Em **Configurações** aparece quantos pedidos
já estão na confecção e quantos aguardam, e o botão **Atualizar e enviar agora**. No computador, o
botão **Atualizar** recarrega a lista na hora (ela também se atualiza sozinha a cada 30 segundos).

Cada pedido vai com as imagens das camisetas, os textos, a prévia das artes da loja e o
**arquivo original** das artes enviadas pelo cliente. Sem internet, o pedido fica "aguardando
envio" (aparece na aba Pedidos do tablet) e vai sozinho quando a internet voltar (ou toque em
**Enviar agora**).

No computador: lista com filtro (em aberto, novo, em produção, pronto, entregue), busca por
nome/telefone/número, atualização automática a cada minuto e aviso quando chega pedido novo.
Abrindo o pedido: camisetas grandes (toque para ampliar), tamanhos e valores, cada arte e texto,
**PDF**, **Artes do cliente** (.zip com todos os arquivos), baixar cada arquivo, mudar a
**situação** e apagar.

Os pedidos ficam guardados no próprio Worker do Cloudflare (Durable Object com SQLite, incluído
no plano grátis; nada a criar no painel). Se preferir, crie no Worker a variável secreta
`PEDIDOS_SENHA`: ela passa a valer no lugar da senha gravada.

## Espaço dos pedidos na nuvem

Os pedidos (dados e imagens das artes) ficam na nuvem da Cloudflare; no plano grátis cabe
**1 GB** (cerca de 1.000 pedidos com arte do catálogo; foto enviada pelo cliente ocupa mais).
O catálogo de artes fica no tablet e não ocupa esse espaço.

- No painel da confecção, o botão **Espaço: X%** mostra o uso. A partir de **70%** aparece um
  aviso; em **90%** ele fica vermelho.
- **Liberar espaço**: apaga só as **imagens das artes** dos pedidos **entregues** há mais de
  1, 3, 6, 12 ou 24 meses. O pedido continua na lista (cliente, camisetas, tamanhos, valores),
  com o aviso "arquivos apagados".
- Plano pago da Cloudflare: crie a variável `ESPACO_LIMITE_MB` no Worker (ex.: `10240`).

## Teclado do tablet

- Com o app em tela cheia não há a barra do Android para baixar o teclado: aparece o botão
  **Pronto** logo acima do teclado. O **Enter** de um campo passa para o próximo.
- O tamanho do teclado é do próprio Android (Gboard): ⚙ do teclado → **Preferências** →
  **Altura do teclado** (baixa / extra baixa). No ícone de teclado da barra do Gboard dá para
  usar o modo **Flutuante** (menor, dá para arrastar) ou **Dividido**.

## Instalar no tablet

1. Abra o endereço do app no **Chrome** (Android) ou **Safari** (iPad).
2. Chrome: menu **⋮** → **Instalar app** (ou **Adicionar à tela inicial** → **Instalar**).
   Abra pelo ícone novo na tela inicial: ele abre em **tela cheia**, sem barra do navegador.
3. Para o cliente não sair do app: Android → Configurações → Segurança → **Fixar app**
   (ative, abra o app, toque no botão de apps recentes, toque no ícone do app → **Fixar**;
   para soltar, segure **Voltar + Apps recentes**). iPad → **Acesso Guiado**.
4. A tela fica sempre ligada com o app aberto (pode desligar em Administrador → Configurações).
   Deixe o tablet na tomada.
5. Depois de aberto uma vez com internet, funciona também sem internet.

## Publicar (Cloudflare)

É um segundo site, separado do original:

1. No Cloudflare: **Workers & Pages → Criar → Importar repositório** (este mesmo).
2. Nome do projeto: `camisetas-tablet` (igual ao `name` de `camisetas_tablet/wrangler.jsonc`).
3. Em **Configurações avançadas → Caminho / Diretório raiz**: `camisetas_tablet`.
4. Comando de deploy: o padrão, `npx wrangler deploy`. Branch: `main`.

(Alternativa sem mudar o diretório raiz: comando `npx wrangler deploy --config wrangler.tablet.jsonc`.)

A busca de imagens usa o Worker (`worker/index.js`, rotas `/api/busca` e `/api/imagem`),
publicado junto com o app. Sem configurar nada ela já funciona (com o limite gratuito do
Openverse). Para mais buscas por dia, cadastre-se grátis na API do Openverse e crie no Worker
as variáveis secretas `OPENVERSE_CLIENT_ID` e `OPENVERSE_CLIENT_SECRET`.

Ao publicar uma versão nova, troque `VERSAO` em `sw.js` para os tablets
baixarem os arquivos novos.

## Onde ajustar

- `js/config.js`: modelos, tamanhos, áreas máximas, malhas, cores e textos padrão.
- `js/medidas.js`: tabelas de medidas.
- `js/texto.js`: fontes, cores e tamanhos dos textos (as fontes vêm do Google Fonts, em `index.html`).
- `js/shirt.js`: desenho das camisetas e posição da área de impressão.
