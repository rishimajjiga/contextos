package com.usecontextos.app.bubble

import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.savedstate.SavedStateRegistry
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner

/**
 * A raw WindowManager overlay (this bubble's host) has no Activity or Fragment behind it, so it
 * has none of the tree owners ComposeView requires to render at all — it throws
 * IllegalStateException("ViewTreeLifecycleOwner not found") without one attached via
 * ViewTreeLifecycleOwner.set(view, owner) before setContent() runs. This supplies the minimum
 * viable set (lifecycle, saved-state, view-model-store) a Service can drive by hand.
 */
class ComposeLifecycleOwner : LifecycleOwner, ViewModelStoreOwner, SavedStateRegistryOwner {

    private val lifecycleRegistry = LifecycleRegistry(this)
    private val savedStateRegistryController = SavedStateRegistryController.create(this)

    override val lifecycle: Lifecycle get() = lifecycleRegistry
    override val viewModelStore: ViewModelStore = ViewModelStore()
    override val savedStateRegistry: SavedStateRegistry get() = savedStateRegistryController.savedStateRegistry

    fun onCreate() {
        // Idempotent by contract: performRestore() throws IllegalStateException if the lifecycle
        // has already advanced past INITIALIZED. The service's recovery paths (health worker,
        // ACTION_RESTORE, boot receiver) can all race onto a service instance whose owner is
        // already live — a second onCreate() must be a no-op, not a process-killing crash.
        if (lifecycleRegistry.currentState != Lifecycle.State.INITIALIZED) return
        savedStateRegistryController.performRestore(null)
        lifecycleRegistry.currentState = Lifecycle.State.CREATED
    }

    fun onStart() {
        lifecycleRegistry.handleLifecycleEvent(Lifecycle.Event.ON_START)
        lifecycleRegistry.handleLifecycleEvent(Lifecycle.Event.ON_RESUME)
    }

    fun onDestroy() {
        lifecycleRegistry.handleLifecycleEvent(Lifecycle.Event.ON_PAUSE)
        lifecycleRegistry.handleLifecycleEvent(Lifecycle.Event.ON_STOP)
        lifecycleRegistry.handleLifecycleEvent(Lifecycle.Event.ON_DESTROY)
        viewModelStore.clear()
    }
}
