# ウェブアプリとしてデプロイする方法

## 完了した作業

1. `appsscript.json`に`webapp`設定を追加
2. 新しいデプロイ（バージョン6）を作成

## 次のステップ

### 1. GASエディタでウェブアプリとして設定

`appsscript.json`に`webapp`設定を追加しましたが、claspからデプロイした場合、GASエディタで手動でウェブアプリとして設定する必要がある場合があります。

1. [GASエディタ](https://script.google.com/d/1OZNbk3v9kgRPDPvsLlaShtG1DhCfMCYdtpnXaRqbX1nqtKS_11ETpPQ_/edit) を開く
2. 「デプロイ」→「デプロイを管理」をクリック
3. 最新のデプロイを選択
4. 「編集」をクリック
5. 歯車アイコン（⚙️）をクリックして「種類の選択」を開く
6. **「ウェブアプリ」を選択**
7. 以下の設定を確認：
   - **次のユーザーとして実行**: 「自分」を選択（重要）
   - **アクセスできるユーザー**: 「自分」を選択
8. 「デプロイ」をクリック

### 2. ウェブアプリのURLを取得

デプロイ後、以下の形式のURLが表示されます：
```
https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec
```

このURLがウェブアプリのURLです。

### 3. 既存のデプロイを更新する場合

今後、コードを更新して既存のウェブアプリデプロイを更新する場合は：

```bash
clasp deploy --deploymentId YOUR_DEPLOYMENT_ID --description "更新内容"
```

これにより、同じURLが維持されます。

## 注意事項

- `appsscript.json`の`webapp`設定は、GASエディタでウェブアプリとして設定する際のデフォルト値として使用されます
- claspから直接ウェブアプリとしてデプロイするには、GASエディタで一度ウェブアプリとして設定する必要がある場合があります
- デプロイIDを指定して更新することで、URLを維持できます

## 参考

- [claspを使用したGASアプリのデプロイ完全ガイド](https://qiita.com/itsutose/items/cf84881b8cb0a21cb04a)

