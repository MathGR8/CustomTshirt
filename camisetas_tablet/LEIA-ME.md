# App do tablet (totem de personalização)

Versão do configurador feita para ficar num **tablet na loja**: o próprio cliente
escolhe a camiseta, a arte (do catálogo da loja), ajusta com o dedo, diz os
tamanhos e recebe o **número do pedido** para mostrar ao atendente.

É independente do configurador do site (`camisetas_refatorado_V2`), que não foi alterado.

## Como o cliente usa

1. **Camiseta**: modelo, malha e cor (a camiseta muda na hora).
2. **Arte**: galeria por temas, com busca. As artes aparecem na cor da camiseta.
   Tocar numa arte mostra ela grande na camiseta, e dá para passar o dedo para ver as próximas.
3. **Ajustar**: arrastar com um dedo, mudar o tamanho com dois dedos ou com os botões + e −.
   A arte nunca passa da área máxima (38 × 42 cm na masculina, 30 × 35 na feminina e
   juvenil; no infantil a arte é reduzida automaticamente para caber em 20 × 24).
4. **Tamanhos**: quantidades com + e −.
5. **Revisar**: dá para adicionar outras camisetas no mesmo pedido.
6. **Seus dados** e **Pronto**: o número do pedido aparece em destaque.

Cada tela tem o botão **Ajuda** com dicas curtas. Na tela inicial há o
**Ver como funciona**, e a primeira vez em "Ajustar" mostra uma dica animada.
Se o cliente sair no meio, depois de alguns minutos o app pergunta
**"Ainda está aí?"** e volta ao início.

## Área do administrador

Toque **5 vezes** no nome da loja (canto superior esquerdo) ou segure o dedo nele
por 2 segundos. Senha inicial: **1234** (troque em Configurações).

- **Artes**: importar arquivos, uma pasta ou um **.ZIP** com pastas. O nome da
  pasta vira o tema (ex.: `Rock/banda.pdf` → tema Rock). Também dá para renomear,
  ocultar, apagar e trocar o tema.
- **Exportar cópia / Importar cópia**: leva o catálogo pronto para outro tablet.
- **Pedidos**: lista com o PDF de cada pedido (imagens da frente e costas,
  tamanhos, nome do arquivo de cada arte e medidas em cm).
- **Configurações**: nome da loja, frase inicial, WhatsApp, senha e tempo de inatividade.

### Formatos das artes

| Formato | Como fica |
|---|---|
| **PDF** (recomendado) | Cada página vira uma arte, recortada em volta do desenho, com fundo transparente. |
| **CorelDRAW (.cdr)** | O navegador não abre arquivos do Corel. O app usa a **imagem de prévia** que o Corel grava dentro do arquivo (resolução menor, com o selo "baixa resolução"). Para melhor qualidade, exporte em PDF. |
| PNG, JPG, SVG | Usados direto (o fundo branco de JPG pode ser removido na importação). |
| .ZIP | Uma pasta compactada com subpastas por tema. |

As artes ficam guardadas **no próprio tablet** (não vão para a internet).

## Instalar no tablet

1. Abra o endereço do app no **Chrome** (Android) ou **Safari** (iPad).
2. Menu → **Adicionar à tela inicial**. Ele abre em tela cheia, como um aplicativo.
3. Para o cliente não sair do app: Android → **Fixar app**; iPad → **Acesso Guiado**.
4. Depois de aberto uma vez com internet, funciona também sem internet.

## Publicar (Cloudflare)

É um segundo site, separado do original:

1. No Cloudflare: **Workers & Pages → Criar → Importar repositório** (este mesmo).
2. Nome do projeto: `camisetas-tablet` (igual ao `name` de `wrangler.tablet.jsonc`).
3. Comando de deploy: `npx wrangler deploy --config wrangler.tablet.jsonc`.

Ao publicar uma versão nova, troque `VERSAO` em `sw.js` para os tablets
baixarem os arquivos novos.

## Onde ajustar

- `js/config.js`: modelos, tamanhos, áreas máximas, malhas, cores e textos padrão.
- `js/shirt.js`: desenho das camisetas e posição da área de impressão.
