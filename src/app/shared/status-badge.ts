import { Component, input } from '@angular/core';
import { EventStatus, STATUS_LABELS } from '../core/models';

@Component({
  selector: 'app-status',
  template: '<span class="badge" [class]="status()">{{ labels[status()] }}</span>',
})
export class StatusBadge {
  readonly status = input.required<EventStatus>();
  readonly labels = STATUS_LABELS;
}
