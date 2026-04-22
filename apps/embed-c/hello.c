#include<stdio.h>
#include<stdlib.h>

int hello(int param) {
    srand(param);
    printf("hello in c %d \n", param);
    return rand();
}

