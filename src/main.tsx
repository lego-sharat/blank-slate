import { render } from 'preact';
import { App } from './App';
import './index.css';
import 'highlight.js/styles/github-dark.css';
import '../markdown-parser.js';

render(<App />, document.getElementById('app')!);
