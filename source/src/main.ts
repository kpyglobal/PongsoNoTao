import './styles/app.css';
import './styles/en.css';
import './styles/cards.css';
import { installUiLang } from './ui/i18n';
import { Game } from './core/game';

installUiLang();

const game = new Game();
void game.boot();
