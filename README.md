# Lucas Dev Hub

Um espaço pessoal para programar, estudar e acompanhar o próprio progresso. O Lucas Dev Hub reúne sessões de foco, tarefas, metas, histórico e notas em uma aplicação web que mantém os dados no navegador.

O projeto foi idealizado para reutilizar um iPad antigo como painel de produtividade sobre a mesa. A interface escura, a navegação por toque e o uso de fontes do sistema também atendem a navegadores de desktop, sem depender de serviços externos para abrir a aplicação.

## Funcionalidades

- **Dashboard:** saudação, data e relógio; foco registrado hoje; meta diária; sessões, sequência de dias, tarefas concluídas e tempo dos últimos sete dias; atalhos e três sessões recentes.
- **Cronômetro:** categoria padrão ou personalizada, pausa, continuação e finalização com confirmação. A sessão ativa sobrevive ao recarregamento.
- **Modo foco:** categoria, tempo e controles em destaque. Voltar ao dashboard mantém a sessão em andamento.
- **Pomodoro:** presets 25/5 e 50/10, tempos personalizados, pausa, continuação, cancelamento e finalização. O foco concluído entra no histórico; o descanso começa quando solicitado.
- **Tarefas:** criação, edição, conclusão, exclusão com confirmação e ordenação por botões. Cada tarefa pertence a uma data; tarefas antigas continuam disponíveis pelo seletor de dia.
- **Meta diária:** padrão de três horas, ajustável nas configurações ou no dashboard. O progresso vem das sessões finalizadas.
- **Histórico:** sessões agrupadas por dia e filtros Hoje, Ontem, Últimos 7 dias, Últimos 30 dias e Todos. A exclusão recalcula os indicadores.
- **Estatísticas:** tempo acumulado, hoje, últimos sete dias e mês atual; quantidade, maior sessão, média, categoria principal, dias ativos e sequência atual. Gráficos mostram tempo por dia e distribuição por categoria.
- **Notas rápidas:** salvamento automático com indicação do estado de persistência.
- **Configurações e dados:** nome, meta, tempos padrão do Pomodoro, exportação e importação de backup JSON, além de exclusão dos dados mediante a confirmação `APAGAR`.
- **PWA básico:** manifest, ícones próprios e cache dos arquivos essenciais, nos navegadores que oferecem suporte.

A aplicação começa com histórico, tarefas e notas vazios. Nenhum dado de demonstração é inserido automaticamente.

## Screenshots

Espaço reservado para capturas reais do dashboard, do modo foco e das estatísticas. As imagens poderão ser adicionadas a `assets/images/` quando houver uma captura aprovada; essa pasta não é necessária para executar o app.

## Stack

HTML5, CSS3, JavaScript Vanilla, APIs nativas do navegador e `localStorage`. Não há framework, backend, banco de dados remoto, dependências de execução ou etapa de build.

Node.js é opcional e serve apenas para os testes automatizados. Não é necessário para abrir ou hospedar a aplicação.

## Como executar

Na pasta do projeto, inicie um servidor estático. Com Python instalado:

```bash
python -m http.server 5500
```

No Windows, caso o Python esteja disponível pelo launcher:

```powershell
py -m http.server 5500
```

Abra [Lucas Dev Hub local](http://localhost:5500/). Para encerrar o servidor, use `Ctrl+C` no terminal.

Como alternativa, abra a pasta no VS Code e use **Open with Live Server** em `index.html`, com a extensão Live Server instalada.

Use um servidor HTTP, em vez de abrir `index.html` por `file://`, para manter uma origem estável para os dados e permitir testar a camada PWA. A aplicação não depende de módulos ES para iniciar.

### Acessar pelo iPad na rede local

Mantenha o servidor e o iPad na mesma rede. No Safari do iPad, abra `http://IP-DO-COMPUTADOR:5500/`, substituindo o endereço pelo IPv4 local do computador. No Windows, `ipconfig` mostra esse endereço. O acesso depende das permissões de rede do computador.

Esse endereço HTTP permite usar a aplicação principal. Para cache offline por service worker em um dispositivo remoto, publique os arquivos em uma hospedagem HTTPS. Dados criados em `localhost`, em um IP ou em um domínio HTTPS pertencem a origens diferentes: transfira-os por backup quando mudar de endereço.

## Como usar

1. Em **Configurações**, ajuste seu nome, a meta diária em minutos e os tempos padrão do Pomodoro.
2. No **Dashboard**, toque em **Começar sessão**, escolha uma categoria ou escreva outra e selecione **Iniciar foco**.
3. Use **Pausar** e **Continuar** quando necessário. **Voltar ao dashboard** mantém o timer ativo; **Abrir modo foco** retorna aos controles.
4. Ao concluir, selecione **Finalizar sessão** e confirme. O registro aparece no histórico e atualiza a meta e as estatísticas.
5. Para ciclos cronometrados, escolha **Pomodoro**. Após concluir o foco, toque em **Começar descanso**. O descanso não soma tempo de estudo.
6. Organize suas **Tarefas** por data e altere a ordem usando as setas. Escreva lembretes em **Notas**, com salvamento automático.
7. Consulte **Histórico** e **Estatísticas** para acompanhar o progresso. Em **Configurações**, exporte backups para guardar ou transferir seus dados.

Cancelar um Pomodoro durante o foco descarta o tempo daquele ciclo. Para registrar um foco parcial, use **Finalizar sessão**. Se o foco já tiver sido concluído e registrado, encerrar ou cancelar o descanso preserva o registro.

## Arquitetura

O código usa scripts tradicionais carregados em ordem no fim de `index.html`. Cada arquivo encapsula suas funções em uma IIFE e expõe somente sua interface no namespace compartilhado `window.Hub`. Isso evita exigir suporte a ES Modules no aparelho antigo e mantém as responsabilidades separadas.

O fluxo principal é:

```text
Interação na interface
        ↓
Módulo da funcionalidade
        ↓
Hub.state: dados e atualização do estado
        ↓
Hub.storage: leitura e gravação no navegador
        ↓
Notificação aos módulos e renderização da tela afetada
```

O estado JavaScript é a fonte de dados; o DOM apresenta esse estado. As chamadas a `localStorage` ficam em `js/services/storage.js`. Uma futura integração com API pode começar nessa fronteira, com a adaptação necessária do fluxo para operações assíncronas. Nenhuma integração remota faz parte desta versão.

O cronômetro e o Pomodoro compartilham `timer.js`. Dashboard, metas, histórico e gráficos derivam seus números das sessões registradas. Os utilitários concentram datas, duração, IDs, criação segura de elementos, ícones, modais e feedback.

### Estrutura de pastas

```text
devhub/
├── index.html
├── manifest.json
├── service-worker.js
├── README.md
├── assets/
│   └── icons/
│       ├── logo.svg
│       ├── favicon.svg
│       ├── apple-touch-icon.png
│       ├── icon-192.png
│       └── icon-512.png
├── css/
│   ├── reset.css
│   ├── variables.css
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   └── responsive.css
├── js/
│   ├── config.js
│   ├── state.js
│   ├── app.js
│   ├── services/
│   │   └── storage.js
│   ├── utils/
│   │   ├── time.js
│   │   └── dom.js
│   └── modules/
│       ├── dashboard.js
│       ├── focus.js
│       ├── timer.js
│       ├── tasks.js
│       ├── history.js
│       ├── stats.js
│       ├── notes.js
│       └── settings.js
└── tests/
    ├── core.test.js
    ├── pwa.test.js
    └── ui.test.js
```

### Arquivos para conhecer primeiro

| Arquivo | Responsabilidade |
| --- | --- |
| `index.html` | Estrutura das telas e ordem de carregamento dos scripts. |
| `js/app.js` | Inicialização, navegação, relógio, atualização das telas e registro do service worker. |
| `js/config.js` | Preferências iniciais, categorias e atalhos. |
| `js/state.js` | Estado, validação de dados, importação e notificações de mudanças. |
| `js/services/storage.js` | Persistência, erros de armazenamento e mudanças entre abas. |
| `js/modules/timer.js` | Cálculo por timestamps, pausas, registros e etapas do Pomodoro. |
| `css/variables.css` | Cores, tipografia e tokens visuais. |

## Onde personalizar

| Ajuste | Pela aplicação | Padrão no código |
| --- | --- | --- |
| Nome | Configurações → Seu nome | `js/config.js` → `defaults.userName` |
| Meta diária | Dashboard → editar meta, ou Configurações | `js/config.js` → `defaults.dailyGoalMinutes` |
| Pomodoro | Configurações ou modal de início do ciclo | `js/config.js` → `defaults.pomodoroFocusMinutes` e `defaults.pomodoroBreakMinutes` |
| Categorias | Digite uma categoria ao iniciar uma sessão | `js/config.js` → `categories` |
| Links de atalhos | Configuração no código | `js/config.js` → `shortcuts` |
| Cores e fontes | Configuração no código | `css/variables.css` |
| Layout e tamanhos de tela | Configuração no código | `css/layout.css`, `css/components.css` e `css/responsive.css` |

Alterações em `defaults` valem para dados novos. Preferências já salvas no navegador continuam valendo e podem ser alteradas pela interface.

Os atalhos GitHub, ChatGPT e MDN já possuem endereços. **Projetos** e **UNIFEBE** ficam como **Link a configurar** até que você informe uma URL HTTP ou HTTPS em `shortcuts`. Links configurados abrem em outra aba.

## Persistência e regras dos dados

- O documento de dados fica na chave `lucasDevHub.data.v1`, com `version`, `settings`, `sessions`, `tasks`, `notes` e `activeSession`.
- A sessão ativa guarda os timestamps de início e pausa, o total pausado, a categoria, o tipo e a etapa. O tempo vem da diferença entre timestamps reais, descontadas as pausas; o intervalo de um segundo apenas atualiza a interface.
- Sessões finalizadas armazenam duração e pausas em segundos. Valores de pausa da sessão ativa são mantidos em milissegundos.
- **Uma sessão que atravessa meia-noite pertence ao dia local em que começou.** A data é registrada na sessão; o tempo não é dividido entre dias.
- A meta usa somente sessões registradas naquele dia. O tempo de uma sessão ativa entra na meta quando ela é finalizada, ou quando a etapa de foco do Pomodoro termina. A barra visual é limitada a 100%, mesmo quando o percentual real ultrapassa a meta.
- Sessões com menos de um segundo não são registradas. Descansos do Pomodoro também não entram nas estatísticas.
- Cada dia com pelo menos uma sessão válida conta como dia ativo. A sequência atual pode terminar hoje ou ontem, dando tempo de estudar hoje sem perder a sequência de imediato.
- “Últimos 7 dias” inclui hoje e os seis dias anteriores. A categoria recente do dashboard considera os últimos 30 dias; a categoria principal das estatísticas considera todo o histórico. A comparação usa tempo de foco acumulado por categoria.
- JSON inválido ou dados incompatíveis não derrubam a interface. O conteúdo original é preservado e um aviso orienta a restaurar backup ou apagar os dados do app antes de voltar a salvar.
- Se a gravação falhar, a interface mantém as alterações na aba e informa o problema. Exporte um backup antes de fechar essa aba.
- Apagar os dados redefine somente o documento deste aplicativo. O app não usa `localStorage.clear()`.

Os dados pertencem ao navegador e à origem usados. Limpar os dados do site, trocar de navegador ou usar outro dispositivo não transfere o histórico. Não há conta, sincronização remota ou backup automático fora do navegador.

### Backup e restauração

Em **Configurações → Seus dados**, **Exportar dados** gera um JSON com versão, preferências, sessões finalizadas, tarefas e notas. A sessão em andamento não é exportada; finalize-a primeiro se quiser transferir esse tempo.

**Importar dados** aceita um JSON de até 5 MB, verifica a versão e a estrutura dos registros e pede confirmação antes de substituir os dados atuais. Uma sessão em andamento é descartada nessa substituição. Exporte o estado atual antes de restaurar outro arquivo.

Em navegadores que não oferecem download por link, o aplicativo tenta abrir o backup em outra aba para que seja salvo pelo recurso de compartilhamento. Esse comportamento precisa ser conferido no Safari usado no aparelho.

## PWA e funcionamento offline

O `manifest.json` define nome, cores, inicialização em modo standalone e ícones PNG de 192 e 512 pixels. O HTML também fornece metadados Apple e um ícone de 180 pixels para a tela inicial.

Em uma hospedagem HTTPS, o aplicativo registra `service-worker.js` quando a API está disponível. Após a instalação bem-sucedida do cache, os arquivos essenciais podem abrir sem conexão. Links externos continuam dependendo de conexão.

No Safari do iPad, abra o endereço da aplicação e use **Compartilhar → Adicionar à Tela de Início**, se a opção estiver disponível. A experiência de instalação e o suporte offline dependem da versão do navegador.

### Desenvolvimento e atualizações

Em `localhost`, `127.0.0.1` e `[::1]`, o registro do service worker fica desativado por padrão para facilitar o desenvolvimento. Para testar o PWA localmente, abra [a versão local com cache habilitado](http://localhost:5500/?pwa=1).

O cache guarda uma versão completa dos arquivos da aplicação. Ao alterar um arquivo essencial, atualize `VERSION` em `service-worker.js`. Ao adicionar ou remover um arquivo carregado pelo app, atualize também `FILES`.

A instalação busca os arquivos novamente na rede, sem reaproveitar respostas antigas do cache HTTP. Publique o conjunto completo de arquivos de cada versão; se um arquivo essencial falhar durante a instalação, a versão anterior continua disponível.

Uma nova versão espera as abas da versão anterior serem fechadas. Quando aparecer o aviso de atualização, feche as abas e janelas do Hub, inclusive a janela instalada, e abra novamente. Caches antigos são removidos somente dentro do prefixo e do escopo desta instalação.

Depois de habilitar o teste PWA local, remover `?pwa=1` da URL não remove um service worker já instalado. Para voltar ao desenvolvimento sem cache, cancele o registro do service worker nas ferramentas do navegador e remova apenas os caches correspondentes. Isso evita apagar o `localStorage` junto com os dados de teste.

## Compatibilidade e limites

Os scripts usam funções tradicionais e IIFEs; o layout utiliza Flexbox com margens para espaçamento, media queries e variáveis CSS. APIs opcionais, como service worker, geração nativa de UUID e Web Audio, são verificadas antes do uso. O cronômetro, as tarefas, as notas e os registros funcionam independentemente do PWA.

A idade aproximada do iPad não identifica a versão do Safari. A versão real do iOS/Safari e os fluxos por toque precisam ser verificados no aparelho. Esta documentação não declara uma versão mínima de iOS nem certifica funcionamento em hardware antigo. Navegadores sem suporte a variáveis CSS podem apresentar limitações visuais.

O tempo continua sendo calculado por timestamps quando a aba volta ao primeiro plano. O navegador pode suspender a execução enquanto estiver em segundo plano: um Pomodoro vencido é reconhecido quando a aplicação volta a executar. O aviso visual e o som podem ocorrer somente nesse momento. O som é discreto, depende de interação anterior e das permissões do navegador; não há dependência de notificações do sistema.

Não há bloqueio automático do repouso da tela nem execução contínua garantida com o navegador fechado. Ajustes manuais no relógio do dispositivo podem afetar o cálculo baseado em horário real. Para evitar conflitos de edição entre abas, prefira manter uma única aba para alterações simultâneas nos mesmos dados.

## Verificação

Com Node.js disponível, execute na raiz:

```bash
node tests/core.test.js
node tests/pwa.test.js
node tests/ui.test.js
```

Os testes de núcleo verificam tempo, pausas, restauração, Pomodoro, estatísticas, validação e persistência em um ambiente controlado. Os testes PWA verificam referências de arquivos, manifest, ícones e o ciclo de cache em uma simulação do service worker, incluindo atualização com cache HTTP antigo. Os testes de interface exercitam os módulos com DOM e eventos simulados.

Esses testes não substituem a execução da interface no navegador nem o teste físico no iPad. Para uma revisão manual, confira:

- Iniciar, pausar, continuar e finalizar uma sessão; conferir histórico, meta e estatísticas.
- Recarregar com uma sessão ativa e com uma sessão pausada.
- Concluir um Pomodoro, iniciar o descanso e confirmar que o foco é registrado uma única vez.
- Criar, editar, ordenar, concluir, recarregar e excluir tarefas; consultar outra data.
- Escrever notas, recarregar e confirmar a persistência.
- Alterar a meta, filtrar o histórico e excluir uma sessão, conferindo os indicadores recalculados.
- Exportar dados, confirmar a limpeza e importar o backup para restaurar o conteúdo.
- Usar teclado e toque, abrir e fechar modais e revisar o layout em orientações horizontal e vertical.
- Testar o cache offline após o primeiro carregamento e a atualização entre versões.

### Validação realizada em 10/09/2026

As três suítes passaram: 27 verificações de núcleo, 13 de PWA e 8 de interface. As regressões incluem proteção dos registros quando o relógio volta durante uma pausa e atualização do PWA com cache HTTP antigo.

No Chrome, em uma origem local separada para testes, foram conferidos: recarga com cronômetro ativo e pausado; retomada e finalização; atualização de meta, histórico e estatísticas; criação e conclusão de tarefa; persistência de notas e tarefas após recarga; alteração da meta; e um Pomodoro completo de 1 minuto de foco e 1 minuto de descanso, sem duplicar o registro. O layout foi inspecionado em desktop e com larguras de 768 e 390 pixels.

Após instalar o PWA local com `?pwa=1`, o servidor foi desligado. A aplicação recarregou e abriu uma URL com query inédita pelo cache; a navegação e a conclusão do descanso continuaram funcionando. A atualização entre versões permanece coberta pela simulação automatizada. Instalação, toque, som e compatibilidade no iPad/Safari ainda exigem validação no aparelho.

## Roadmap

### V1 — aplicação local

Dashboard, cronômetro, Pomodoro, tarefas, metas, notas, histórico, estatísticas, gráficos, configurações, backup e PWA básico.

### V2 — organização e personalização

Evoluir os gráficos, oferecer gerenciamento de categorias personalizadas, acrescentar calendário e ampliar opções de personalização. A V1 já permite digitar uma categoria por sessão.

### V3 — integrações e widgets

Explorar integração com GitHub, consumo de APIs e widgets úteis para a rotina.

### V4 — conta e sincronização

Avaliar backend, login, sincronização entre dispositivos e Supabase. Essas integrações são possibilidades futuras e não estão implementadas na V1.
