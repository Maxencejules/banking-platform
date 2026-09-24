import { ChangeDetectionStrategy, Component, ElementRef, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountService } from '../../core/api/account.service';
import { AccountResponse } from '../../core/api/models';
import { errorMessage, fieldErrorsOf } from '../../core/util/errors';
import { controlMessage, focusFirstInvalid } from '../../core/util/forms';
import { NICKNAME_MAX } from '../../core/util/validators';
import { IconComponent } from '../../shared/icon';
import { ModalComponent } from '../../shared/modal';

@Component({
  selector: 'app-rename-dialog',
  imports: [ReactiveFormsModule, ModalComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal heading="Rename account" size="sm" [busy]="submitting()" (closed)="closed.emit()">
      <form class="form-grid" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (serverError(); as message) {
          <div class="alert alert-error" role="alert">
            <app-icon name="alert" />
            <span>{{ message }}</span>
          </div>
        }
        @let nicknameError = fieldError();
        <div class="field">
          <label class="field-label" for="rename-nickname">Nickname</label>
          <input
            id="rename-nickname"
            class="control"
            type="text"
            formControlName="nickname"
            [attr.maxlength]="nicknameMax"
            [attr.aria-invalid]="!!nicknameError"
            [attr.aria-describedby]="nicknameError ? 'rename-nickname-error' : 'rename-nickname-hint'"
          />
          @if (nicknameError) {
            <p class="field-error" id="rename-nickname-error">{{ nicknameError }}</p>
          } @else {
            <p class="field-hint" id="rename-nickname-hint">Up to {{ nicknameMax }} characters.</p>
          }
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" [disabled]="submitting()" (click)="closed.emit()">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" [disabled]="submitting()">
            @if (submitting()) {
              <span class="btn-spinner" aria-hidden="true"></span>
            }
            Save
          </button>
        </div>
      </form>
    </app-modal>
  `,
})
export class RenameDialogComponent implements OnInit {
  private readonly accounts = inject(AccountService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly account = input.required<AccountResponse>();
  readonly renamed = output<AccountResponse>();
  readonly closed = output<void>();

  protected readonly nicknameMax = NICKNAME_MAX;
  protected readonly form = inject(FormBuilder).nonNullable.group({
    nickname: ['', [Validators.required, Validators.maxLength(NICKNAME_MAX)]],
  });
  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly serverFieldError = signal<string | null>(null);

  ngOnInit(): void {
    this.form.setValue({ nickname: this.account().nickname ?? '' });
  }

  protected fieldError(): string | null {
    return controlMessage(this.form.controls.nickname, 'Nickname', this.submitted(), this.serverFieldError());
  }

  protected submit(): void {
    this.submitted.set(true);
    this.serverError.set(null);
    this.serverFieldError.set(null);
    const nickname = this.form.controls.nickname.value.trim();
    if (!nickname) {
      this.form.controls.nickname.setValue('');
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }

    this.submitting.set(true);
    this.accounts.rename(this.account().id, nickname).subscribe({
      next: (account) => {
        this.submitting.set(false);
        this.renamed.emit(account);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.serverFieldError.set(fieldErrorsOf(error)['nickname'] ?? null);
        this.serverError.set(errorMessage(error, 'Could not rename the account.'));
      },
    });
  }
}
