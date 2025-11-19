import { render } from 'preact';
import { App } from '@/App';
import './index.css';
import 'highlight.js/styles/github-dark.css';

render(<App />, document.getElementById('app')!);
