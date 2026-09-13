 TechProt Web (Power System Platform)

Plataforma Web completa de simulação de sistemas elétricos de potência **TechProt**, desenvolvida em JavaScript moderno (ES6 modules), HTML5 Canvas e CSS3 para execução direta no navegador.

---

## 🚀 Como Executar

Por utilizar módulos ES6 nativos (`import`/`export`), a aplicação necessita de um servidor HTTP simples para ser executada:

### Opção 1: Node.js (npx serve)
```bash
cd web
npx serve .
# ou a partir da raiz:
npx serve web
```

### Opção 2: Python 3
```bash
python -m http.server 8080 -d web
```

Abra seu navegador em: `http://localhost:8080` (ou na porta indicada pelo terminal).

---

## 📂 Arquitetura do Projeto

```
web/
├── index.html                  # Interface gráfica principal e layout SPA
├── css/
│   ├── app.css                 # Estilos globais, ribbon, temas escuro/claro e modais
│   └── icons.css               # Ícones da barra de ferramentas e ribbon
├── js/
│   ├── app.js                  # Ponto de entrada (App), atalhos, menu de contexto e eventos
│   ├── cad/
│   │   ├── Canvas.js           # Gerenciador do Canvas, zoom/pan, seleção, arraste e snap
│   │   └── Renderer.js         # Renderização gráfica CAD dos elementos, disjuntores e rótulos
│   ├── elements/
│   │   ├── Element.js          # Classe base de elementos CAD
│   │   ├── Bus.js              # Barras, níveis de tensão, faltas e curto-circuito
│   │   ├── Line.js             # Linhas de transmissão com disjuntores nas extremidades
│   │   ├── Transformer.js      # Transformadores com disjuntores, tap fixo e regulador OLTC
│   │   ├── Generator.js        # Geradores com rotação, AVR e regulador de velocidade
│   │   ├── Load.js             # Cargas elétricas com disjuntor para ligar/desligar
│   │   ├── Shunt.js            # Bancos de capacitores e reatores
│   │   └── TextLabel.js        # Rótulos móveis desacoplados (nome, tensão, ângulo, fluxos, etc.)
│   ├── simulation/
│   │   ├── PowerFlow.js        # Fluxo de potência (Newton-Raphson e Gauss-Seidel) + controle OLTC
│   │   ├── Stability.js        # Estabilidade transitória eletromecânica multi-máquinas (Heun/Euler)
│   │   ├── ShortCircuit.js     # Curto-circuito por componentes simétricas com contribuições de ramo
│   │   ├── YBus.js             # Montagem da matriz de admitância nodal Ybus
│   │   └── Harmonics.js        # Análise harmônica preliminar e THD
│   ├── control/
│   │   ├── ControlBlock.js     # Blocos funcionais (ganho, integrador, atraso, wash-out, limites)
│   │   ├── ControlDiagram.js   # Diagrama de blocos de controle de geradores (AVR / Gov)
│   │   └── ControlPresets.js   # Presets clássicos IEEE (IEEE Type 1, ST1A, IEEEG1, Hydro)
│   ├── ui/
│   │   ├── TabbedToolbar.js    # Barra de ferramentas com abas Ribbon (Arquivo, Ferramentas, Simulação)
│   │   ├── Dialogs.js          # Diálogos modais de propriedades dos elementos
│   │   ├── ControlEditorDialog.js # Editor visual do diagrama de blocos de controle
│   │   ├── StabilityDialog.js  # Janela de configuração de eventos e execução de estabilidade
│   │   ├── StabilityChart.js   # Gráficos dinâmicos multi-séries com Chart.js
│   │   ├── LabelManagerDialog.js # Gerenciador de Rótulos do diagrama com pré-visualização
│   │   ├── FloatingToolbar.js  # Barra flutuante de ferramentas CAD
│   │   ├── MenuBar.js          # Menu superior tradicional
│   │   ├── ReportDialog.js     # Relatórios tabulares de resultados
│   │   └── i18n.js             # Suporte multilíngue (Português / Inglês)
│   └── io/
│       ├── TechProtParser.js        # Leitor de arquivos nativos (.tp e legados .psp/.xml/.txt)
│       ├── TechProtSerializer.js    # Exportador para o formato nativo .tp (XML interno idêntico)
│       └── SampleSystems.js    # Sistemas de teste IEEE 14 e IEEE 9 (OLTC e Estabilidade)
└── assets/icons/               # Ícones vetoriais SVG e PNG para interface
```

---

## ⚙️ Principais Recursos Implementados

1. **CAD Interativo com Disjuntores Reativos**:
   - Elementos de ramos (linhas e trafos), geradores e cargas possuem disjuntores clicáveis.
   - Estado fechado (verde) / aberto (vermelho); quando aberto, o elemento fica em cinza e é automaticamente retirado das simulações.
2. **Gerenciador de Rótulos com Mobilidade Total**:
   - Nomes das barras, tensões, ângulos, fluxos e faltas são elementos móveis independentes.
   - Ao mover a barra, todos os rótulos filhos mantêm a distância relativa e acompanham o elemento.
   - Controle de exibição via Label Manager.
3. **Controles de Geração (AVR e Regulador de Velocidade)**:
   - Diagrama de blocos editável para cada gerador com blocos funcionais e saturações.
4. **Cálculo de Curto-Circuito Completo**:
   - Componentes simétricas para faltas trifásicas, fase-terra, fase-fase e bifásica-terra com resistência e reatância de falta arbitrárias.
   - Exibição de contribuições de falta nos ramos (linhas e transformadores) com setas de fluxo.
5. **Estabilidade Transitória Eletromecânica**:
   - Integração da equação de oscilação multi-máquinas pelo método Preditor-Corretor de Heun (Modified Euler).
   - Eventos dinâmicos de falta na linha do tempo e gráficos de ângulo de carga $\delta(t)$, velocidade $\omega(t)$, potência $P_e(t)$ e tensões $V(t)$.
"# techprot" 
