/**
 * @module sizeModule
 * @description Gerencia a tabela de tamanhos e quantidades do pedido.
 *
 * Responsabilidades:
 *  - Renderizar a tabela de tamanhos conforme a categoria selecionada.
 *  - Persistir as quantidades digitadas no AppState.
 *  - Calcular e exibir o total de peças.
 *  - Coletar as quantidades da tabela para uso no pedido e PDF.
 *  - Alternar a exibição entre a seção de configuração e a seção de tamanhos.
 *
 * Dependências: appState.js, logger.js, uiModule.js.
 * Módulos relacionados: orderModule.js, pdfModule.js.
 */

import { AppState } from '../core/appState.js';
import { Logger } from '../core/logger.js';
import { UIModule } from '../ui/uiModule.js';
import { Utils } from '../utils/helpers.js';

export const SizeModule = {
  /**
   * Renderiza a tabela de tamanhos para a categoria selecionada.
   * Recupera quantidades salvas no AppState para preencher os inputs.
   * Persiste as alterações no AppState em tempo real.
   */
  updateSizeTable() {
    const category = document.getElementById("category")?.value;
    if (!category) return;

    const sizes = category === "Masculina"
      ? ["P", "M", "G", "GG", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "X8"]
      : category === "Feminina"
        ? ["P", "M", "G", "GG"]
        : ["01", "02", "04", "06", "08", "10", "12", "14"];

    const table = document.getElementById("sizeTable");
    if (!table) return;
    table.innerHTML = "";

    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Tamanho</th><th>Quantidade</th></tr>";
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    // Inicializa o objeto de quantidades para a categoria se não existir
    if (!AppState.quantities[category]) AppState.quantities[category] = {};

    sizes.forEach(sz => {
      const tr  = document.createElement("tr");
      const td1 = document.createElement("td");
      td1.textContent = sz;

      const td2 = document.createElement("td");
      td2.className = "quantityControl";

      const inp = document.createElement("input");
      inp.type  = "number";
      inp.min   = "0";
      inp.step  = "1";
      inp.inputMode = "numeric";
      // Recupera o valor salvo ou define como 0
      inp.value = AppState.quantities[category][sz] || "0";
      inp.dataset.size = sz;

      inp.addEventListener('input', () => {
        // Persiste no estado global imediatamente ao digitar
        // Impede quantidade negativa ou inválida
        if (parseInt(inp.value, 10) < 0) inp.value = "0";
        AppState.quantities[category][sz] = Math.max(0, parseInt(inp.value || "0", 10) || 0);
        UIModule.syncUiState();
        this._updateTotalLabel();
      });

      td2.appendChild(Utils.stepper(inp));
      tr.append(td1, td2);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    this._updateTotalLabel();
    Logger.info('UI', `Tabela de tamanhos atualizada para categoria "${category}"`);
  },

  /**
   * Atualiza o label de total de peças abaixo da tabela.
   * Exibe o total apenas se for maior que zero.
   * @private
   */
  _updateTotalLabel() {
    const total = this.collectSizes().reduce((sum, s) => sum + (parseInt(s.qty || 0, 10) || 0), 0);
    const lbl = document.getElementById('totalPiecesLabel');
    if (lbl) lbl.textContent = total > 0 ? `Total: ${total} peça(s)` : '';
  },

  /**
   * Coleta todas as quantidades preenchidas na tabela de tamanhos.
   * @returns {Array<{ size: string, qty: number }>} Array de objetos com tamanho e quantidade.
   */
  collectSizes() {
    const inputs = document.querySelectorAll("#sizeTable input[type=number]");
    return Array.from(inputs).map(inp => ({
      size: inp.dataset.size,
      qty:  Math.max(0, parseInt(inp.value || "0", 10) || 0)
    }));
  },

  /**
   * Exibe a seção de tamanhos e oculta a seção de configuração.
   */
  showSizeSection() {
    const config = document.getElementById("configSection");
    const size   = document.getElementById("sizeSection");
    if (config) config.style.display = "none";
    if (size)   size.style.display   = "block";
    Logger.info('UI', 'Seção de tamanhos exibida');
  },

  /**
   * Exibe a seção de configuração e oculta a seção de tamanhos.
   */
  backToConfig() {
    const config = document.getElementById("configSection");
    const size   = document.getElementById("sizeSection");
    if (size)   size.style.display   = "none";
    if (config) config.style.display = "block";
    Logger.info('UI', 'Retornou à seção de configuração');
  }
};
