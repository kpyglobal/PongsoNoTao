import './styles/app.css';
import './styles/en.css';
import './styles/cards.css';
import { installUiLang } from './ui/i18n';
import { Game } from './core/game';
import { loadContentLang } from './content/loader';

installUiLang();
await loadContentLang();

const game = new Game();
void game.boot();
