public class Main {
    public static void main(String[] args) {
        for (int row = 0; row < 2; row++) {
            for (int cell = 0; cell < 2; cell++) {
                move();
            }
            turnLeft();
        }
    }
}
