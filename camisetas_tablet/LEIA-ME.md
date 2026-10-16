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

## Pedidos no computador da confecção

Os pedidos são feitos no tablet da loja e podem ser vistos em qualquer computador:

1. O envio já vem **ligado**: cada pedido novo feito no tablet vai sozinho para a confecção.
   A **senha inicial da confecção é `000000`**.
2. No computador: abra `https://<endereço do app>/pedidos.html` e entre com a senha.
3. Para trocar a senha (recomendado): no tablet, **Administrador → Configurações → Pedidos no
   computador da confecção**, preencha **Trocar a senha da confecção** (mínimo 6 caracteres) e
   toque em **Testar e salvar**. No computador, entre de novo com a nova senha.

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
