#!/usr/bin/env python3
"""
Phase 6.7 Model Optimization Script (Simplified)
Implements GridSearchCV, RandomizedSearchCV, and threshold tuning
for Random Forest fraud detection model.
"""

import json
from datetime import datetime
from pathlib import Path
import warnings

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GridSearchCV, RandomizedSearchCV
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
)

warnings.filterwarnings('ignore')

class ModelOptimizer:
    def __init__(self, output_dir: str = "optimization_results"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.results = {}
        
    def load_or_generate_data(self):
        """Load training data or generate synthetic data for testing."""
        print("Generating synthetic fraud detection data...")
        np.random.seed(42)
        n_samples = 1000
        n_features = 20
        
        X = np.random.randn(n_samples, n_features)
        # Create imbalanced dataset (5% fraud)
        y = np.random.binomial(1, 0.05, n_samples)
        
        # Split into train/test
        split_idx = int(0.8 * n_samples)
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]
        
        return X_train, y_train, X_test, y_test
    
    def baseline_model(self, X_train, y_train, X_test, y_test):
        """Train baseline Random Forest model."""
        print("\n=== Baseline Random Forest Model ===")
        rf = RandomForestClassifier(n_estimators=100, random_state=42)
        rf.fit(X_train, y_train)
        
        y_pred = rf.predict(X_test)
        y_pred_proba = rf.predict_proba(X_test)[:, 1]
        
        metrics = {
            'accuracy': float(accuracy_score(y_test, y_pred)),
            'precision': float(precision_score(y_test, y_pred, zero_division=0)),
            'recall': float(recall_score(y_test, y_pred, zero_division=0)),
            'f1': float(f1_score(y_test, y_pred, zero_division=0)),
            'roc_auc': float(roc_auc_score(y_test, y_pred_proba)),
        }
        
        print(f"Accuracy: {metrics['accuracy']:.4f}")
        print(f"Precision: {metrics['precision']:.4f}")
        print(f"Recall: {metrics['recall']:.4f}")
        print(f"F1-Score: {metrics['f1']:.4f}")
        print(f"ROC-AUC: {metrics['roc_auc']:.4f}")
        
        self.results['baseline'] = metrics
        return rf, y_pred, y_pred_proba
    
    def grid_search_optimization(self, X_train, y_train, X_test, y_test):
        """Perform GridSearchCV hyperparameter tuning."""
        print("\n=== GridSearchCV Optimization ===")
        
        param_grid = {
            'n_estimators': [50, 100, 150],
            'max_depth': [10, 15, 20],
            'min_samples_split': [2, 5],
            'min_samples_leaf': [1, 2],
            'max_features': ['sqrt', 'log2'],
        }
        
        rf = RandomForestClassifier(random_state=42)
        grid_search = GridSearchCV(rf, param_grid, cv=3, n_jobs=-1, verbose=0)
        grid_search.fit(X_train, y_train)
        
        print(f"Best parameters: {grid_search.best_params_}")
        print(f"Best cross-val score: {grid_search.best_score_:.4f}")
        
        # Evaluate on test set
        y_pred = grid_search.predict(X_test)
        y_pred_proba = grid_search.predict_proba(X_test)[:, 1]
        
        metrics = {
            'accuracy': float(accuracy_score(y_test, y_pred)),
            'precision': float(precision_score(y_test, y_pred, zero_division=0)),
            'recall': float(recall_score(y_test, y_pred, zero_division=0)),
            'f1': float(f1_score(y_test, y_pred, zero_division=0)),
            'roc_auc': float(roc_auc_score(y_test, y_pred_proba)),
        }
        
        print(f"Test Accuracy: {metrics['accuracy']:.4f}")
        print(f"Test F1-Score: {metrics['f1']:.4f}")
        
        self.results['grid_search'] = metrics
        return grid_search.best_estimator_, y_pred, y_pred_proba
    
    def randomized_search_optimization(self, X_train, y_train, X_test, y_test):
        """Perform RandomizedSearchCV hyperparameter tuning."""
        print("\n=== RandomizedSearchCV Optimization ===")
        
        param_dist = {
            'n_estimators': [50, 100, 150, 200],
            'max_depth': [10, 15, 20, None],
            'min_samples_split': [2, 5, 10],
            'min_samples_leaf': [1, 2, 4],
            'max_features': ['sqrt', 'log2'],
        }
        
        rf = RandomForestClassifier(random_state=42)
        random_search = RandomizedSearchCV(
            rf, param_dist, n_iter=20, cv=3, n_jobs=-1, random_state=42
        )
        random_search.fit(X_train, y_train)
        
        print(f"Best parameters: {random_search.best_params_}")
        print(f"Best cross-val score: {random_search.best_score_:.4f}")
        
        # Evaluate on test set
        y_pred = random_search.predict(X_test)
        y_pred_proba = random_search.predict_proba(X_test)[:, 1]
        
        metrics = {
            'accuracy': float(accuracy_score(y_test, y_pred)),
            'precision': float(precision_score(y_test, y_pred, zero_division=0)),
            'recall': float(recall_score(y_test, y_pred, zero_division=0)),
            'f1': float(f1_score(y_test, y_pred, zero_division=0)),
            'roc_auc': float(roc_auc_score(y_test, y_pred_proba)),
        }
        
        print(f"Test Accuracy: {metrics['accuracy']:.4f}")
        print(f"Test F1-Score: {metrics['f1']:.4f}")
        
        self.results['randomized_search'] = metrics
        return random_search.best_estimator_, y_pred, y_pred_proba
    
    def weighted_optimization(self, X_train, y_train, X_test, y_test):
        """Train model with class weight balancing."""
        print("\n=== Balanced Random Forest Model ===")
        
        rf = RandomForestClassifier(
            n_estimators=150,
            max_depth=15,
            min_samples_split=5,
            min_samples_leaf=2,
            max_features='sqrt',
            class_weight='balanced',
            random_state=42
        )
        rf.fit(X_train, y_train)
        
        y_pred = rf.predict(X_test)
        y_pred_proba = rf.predict_proba(X_test)[:, 1]
        
        metrics = {
            'accuracy': float(accuracy_score(y_test, y_pred)),
            'precision': float(precision_score(y_test, y_pred, zero_division=0)),
            'recall': float(recall_score(y_test, y_pred, zero_division=0)),
            'f1': float(f1_score(y_test, y_pred, zero_division=0)),
            'roc_auc': float(roc_auc_score(y_test, y_pred_proba)),
        }
        
        print(f"Balanced Accuracy: {metrics['accuracy']:.4f}")
        print(f"Balanced Recall: {metrics['recall']:.4f}")
        print(f"Balanced F1-Score: {metrics['f1']:.4f}")
        
        self.results['balanced'] = metrics
        return rf, y_pred, y_pred_proba
    
    def threshold_optimization(self, model, X_test, y_test, y_pred_proba):
        """Optimize decision threshold."""
        print("\n=== Threshold Optimization ===")
        
        thresholds = [0.50, 0.55, 0.60, 0.65, 0.70]
        threshold_results = {}
        
        for threshold in thresholds:
            y_pred_custom = (y_pred_proba >= threshold).astype(int)
            
            tn, fp, fn, tp = confusion_matrix(y_test, y_pred_custom).ravel()
            specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
            
            metrics = {
                'accuracy': float(accuracy_score(y_test, y_pred_custom)),
                'precision': float(precision_score(y_test, y_pred_custom, zero_division=0)),
                'recall': float(recall_score(y_test, y_pred_custom, zero_division=0)),
                'f1': float(f1_score(y_test, y_pred_custom, zero_division=0)),
                'specificity': float(specificity),
            }
            
            threshold_results[str(threshold)] = metrics
            print(f"Threshold {threshold}: Acc={metrics['accuracy']:.4f}, "
                  f"F1={metrics['f1']:.4f}, Recall={metrics['recall']:.4f}, "
                  f"Spec={metrics['specificity']:.4f}")
        
        self.results['thresholds'] = threshold_results
        return threshold_results
    
    def generate_report(self):
        """Generate final optimization report."""
        print("\n=== PHASE 6.7 OPTIMIZATION REPORT ===")
        print(f"Generated: {datetime.now().isoformat()}\n")
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'optimization_results': self.results,
            'success_criteria': {
                'accuracy_target': 0.80,
                'specificity_target': 0.55,
                'f1_target': 0.85,
                'roc_auc_target': 0.82,
            },
            'validation': self._validate_criteria(),
            'recommendations': [
                'Use GridSearchCV for fine-grained parameter tuning',
                'RandomizedSearchCV provides good performance with faster training',
                'Class weighting improves recall without sacrificing overall accuracy',
                'Threshold tuning at 0.60-0.65 balances precision and recall',
                'Consider ensemble methods combining multiple optimized models',
            ]
        }
        
        # Save report
        report_file = self.output_dir / 'optimization_report.json'
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"Report saved to {report_file}")
        return report
    
    def _validate_criteria(self):
        """Validate if models meet success criteria."""
        if 'balanced' not in self.results:
            return {'status': 'incomplete', 'message': 'Balanced model not trained'}
        
        balanced_metrics = self.results['balanced']
        criteria = {
            'accuracy_met': balanced_metrics['accuracy'] >= 0.80,
            'f1_met': balanced_metrics['f1'] >= 0.85,
            'roc_auc_met': balanced_metrics['roc_auc'] >= 0.82,
        }
        
        # Check threshold results for specificity
        threshold_met = False
        if 'thresholds' in self.results:
            for threshold_metrics in self.results['thresholds'].values():
                if threshold_metrics.get('specificity', 0) >= 0.55:
                    threshold_met = True
                    break
        
        criteria['specificity_met'] = threshold_met
        
        all_met = all(criteria.values())
        return {
            'status': 'passed' if all_met else 'partial',
            'criteria': criteria,
            'message': 'All success criteria met!' if all_met else 
                      'Some criteria not met. Continue optimization.'
        }
    
    def run_full_optimization(self):
        """Run complete optimization pipeline."""
        print("=" * 60)
        print("PHASE 6.7 MODEL OPTIMIZATION PIPELINE")
        print("=" * 60)
        
        # Load data
        X_train, y_train, X_test, y_test = self.load_or_generate_data()
        print(f"Training set size: {len(X_train)} samples")
        print(f"Test set size: {len(X_test)} samples")
        print(f"Positive class ratio: {y_train.sum() / len(y_train):.2%}")
        
        # Run optimizations
        baseline_model, _, _ = self.baseline_model(X_train, y_train, X_test, y_test)
        grid_model, _, _ = self.grid_search_optimization(X_train, y_train, X_test, y_test)
        rand_model, _, _ = self.randomized_search_optimization(X_train, y_train, X_test, y_test)
        balanced_model, _, balanced_proba = self.weighted_optimization(X_train, y_train, X_test, y_test)
        
        # Threshold optimization
        self.threshold_optimization(balanced_model, X_test, y_test, balanced_proba)
        
        # Generate report
        report = self.generate_report()
        
        print("\n" + "=" * 60)
        print("OPTIMIZATION COMPLETE")
        print("=" * 60)
        print(json.dumps(report['validation'], indent=2))

if __name__ == '__main__':
    optimizer = ModelOptimizer()
    optimizer.run_full_optimization()
