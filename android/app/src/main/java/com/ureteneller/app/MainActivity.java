package com.ureteneller.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import com.google.android.gms.auth.api.signin.GoogleSignInOptions;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(getString(R.string.default_web_client_id))
            .requestEmail()
            .build();
    }
}

