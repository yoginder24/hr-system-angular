import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet], // things this template is allowed to use
  templateUrl: './app.html',
})
export class App {}
