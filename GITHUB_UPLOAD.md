# GitHub에 올리기

이 ZIP은 웹 소스, 완성된 v2 모델, 티처블 머신 `.tm` 프로젝트, 학습·평가 자료, Linux 배포 설정을 담은 저장소용 묶음입니다. Git 이력이나 로그인 정보는 포함하지 않습니다.

먼저 ZIP을 압축 해제합니다. **`parking-four-ai` 안의 파일이 저장소 루트에 오도록** 올립니다. ZIP 파일 하나만 저장소에 올리면 코드와 README가 자동으로 압축 해제되지는 않습니다.

## GitHub Desktop으로 올리기

1. 압축을 해제하고 `parking-four-ai` 폴더가 있는 위치를 확인합니다.
2. GitHub Desktop에서 로그인한 뒤 **File → New repository**를 엽니다.
3. 새 저장소 이름과 위치를 지정해 빈 로컬 저장소를 만듭니다.
4. `parking-four-ai` 안의 내용을 새 로컬 저장소로 복사합니다. `.github`와 `.gitignore`도 포함합니다.
5. GitHub Desktop에서 변경 파일을 확인하고 **Commit to main**을 누릅니다.
6. **Publish repository**를 누릅니다. 비공개로 올리려면 **Keep this code private**를 유지합니다.

## CLI로 올리기

Git과 GitHub CLI(`gh`)가 설치돼 있고 Git 사용자 이름·이메일이 설정돼 있어야 합니다. 압축을 해제한 `parking-four-ai` 안에서 실행합니다.

```bash
git init -b main
git add .
git commit -m "Add parking AI project and Teachable Machine source"
gh auth login
gh repo create parking-four-ai --private --source . --remote origin --push
```

`gh auth login`은 내 GitHub 계정으로 진행합니다. 이미 같은 이름의 저장소가 있다면 마지막 명령의 `parking-four-ai`를 새 이름으로 바꿉니다. 이 절차는 빈 폴더에서 새로운 저장소를 만드는 경우를 위한 것입니다.

## 웹으로 올리기

1. GitHub에서 빈 저장소를 만듭니다.
2. **uploading an existing file** 또는 **Add file → Upload files**를 엽니다.
3. 압축을 해제한 `parking-four-ai` 안의 파일과 폴더를 올립니다. 한 번에 모두 선택되지 않으면 나눠 올립니다.
4. `README.md`, `dist/`, `training/parking-v2-training-source.tm`, `.github/workflows/tests.yml`, `.gitignore`가 원래 경로로 올라갔는지 확인하고 커밋합니다.

브라우저 업로드는 파일당25MiB 제한이 있습니다. 이 묶음의 개별 파일은 모두 이 제한보다 작습니다. 전체 프로젝트 ZIP 자체는 약30MB이므로 먼저 압축을 풀어 내부 파일을 올립니다.

## 실행과 모델 확인

웹앱은 `python serve.py`로 실행하고 http://localhost:8000 에서 확인합니다.

티처블 머신에서 확인할 파일은 **`training/parking-v2-training-source.tm`**입니다. [티처블 머신 안내](docs/teachable-machine.md)의 **Open project from file → Train Model → 미리보기** 순서로 진행합니다. `.tm`은 학습 전 원본이고 사이트의 완성 모델은 `dist/models/parking/`에 따로 포함돼 있습니다.

Linux 상시 운영은 [Linux 배포 안내](docs/linux.md)를 참고합니다. 학습·평가 자료를 압축 해제하는 방법과 테스트 명령은 [README](README.md)에 있습니다.

공식 참고:

- https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github
- https://cli.github.com/manual/gh_repo_create
