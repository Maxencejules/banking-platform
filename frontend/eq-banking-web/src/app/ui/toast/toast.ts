import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],      // gives us *ngIf and |async
  templateUrl: './toast.html',
  styleUrls: ['./toast.scss']
})
export class ToastComponent {

  // stream used in the template: *ngIf="toast$ | async as toast"
  toast$!: Observable<Toast | null>;

  constructor(private toastService: ToastService) {
    // now TypeScript is happy: property is assigned in the constructor
    this.toast$ = this.toastService.toast$;
  }

  dismiss(): void {
    this.toastService.clear();
  }
}
